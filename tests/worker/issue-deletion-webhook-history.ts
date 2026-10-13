import { env } from "cloudflare:workers";
import { expect } from "vitest";
import {
  D1SqlDatabase,
  IntegrationsRepository,
  createWebhookProtocol,
  verifyWebhook,
} from "../../vendor/base/integrations";
import type { WorkerBindings } from "../../src/core/app/bindings";
import { outboundService } from "../../src/core/features/integrations/outbound";
import { setupIntegrations } from "./integration-fixture";
/** Native publication and operator resolution, plus a Base receiver inbox as can
 * arrive in an existing archive. Vector mounts no generic replay receiver. */
export async function proveWebhookHistory(
  f: Awaited<ReturnType<typeof setupIntegrations>>,
  current: WorkerBindings,
  workspace: string,
  destinationId: string,
) {
  const issue = await f.create({
    title: "Confidential_reconciliation_customer",
  });
  const event = await env.DB.prepare(
    "SELECT id,event,body FROM vector_webhook_events WHERE json_extract(body,'$.identifier')=?",
  )
    .bind(issue.identifier)
    .first<{ id: string; event: string; body: string }>();
  const envelope = {
    id: event!.id,
    tenant: workspace,
    destinationId,
    event: event!.event,
    protocol: "webhook",
    body: event!.body,
  };
  const key = crypto.getRandomValues(new Uint8Array(32));
  const wire = await createWebhookProtocol({
    resolveDestination: async () => "https://receiver.example.com/events",
    signingKey: async () => key,
  }).prepare(envelope, Date.now());
  const verified = await verifyWebhook({
    body: wire.body,
    headers: wire.headers,
    key,
    tenant: workspace,
    destinationId,
  });
  const repository = new IntegrationsRepository(
    new D1SqlDatabase(env.DB),
    workspace,
  );
  expect(await repository.acceptReplay(verified)).toBe(true);
  const replay = await env.DB.prepare(
    "SELECT * FROM integration_replays WHERE namespace=? AND id=?",
  )
    .bind(workspace, event!.id)
    .first<Record<string, unknown>>();
  const service = outboundService(
    {
      ...current,
      INTEGRATION_EGRESS: {
        async send(request) {
          return { status: 503, headers: {}, body: request.body };
        },
      },
    },
    workspace,
  );
  await service.enqueue(envelope);
  expect((await service.dispatch(event!.id))?.state).toBe("uncertain");
  const before = await service.log(event!.id);
  expect(before).toHaveLength(1);
  expect(JSON.stringify(before)).not.toContain(issue.title);
  const resolved = await f.call(
    "/settings/integrations/deliveries/" + event!.id + "/resolve",
    "POST",
    { kind: "accepted", evidenceCode: issue.title },
  );
  expect(resolved.status).toBe(200);
  const resolution = await env.DB.prepare(
    "SELECT * FROM integration_resolutions WHERE namespace=? AND delivery_id=?",
  )
    .bind(workspace, event!.id)
    .first<{ id: string; outcome: string }>();
  expect(JSON.parse(resolution!.outcome).code).toBe(issue.title);
  const control = await f.create({
    title: "Unrelated_reconciliation_customer",
  });
  const controlEvent = await env.DB.prepare(
    "SELECT id,event,body FROM vector_webhook_events WHERE json_extract(body,'$.identifier')=?",
  )
    .bind(control.identifier)
    .first<{ id: string; event: string; body: string }>();
  const controlEnvelope = {
    ...envelope,
    id: controlEvent!.id,
    event: controlEvent!.event,
    body: controlEvent!.body,
  };
  const controlWire = await createWebhookProtocol({
    resolveDestination: async () => "https://receiver.example.com/events",
    signingKey: async () => key,
  }).prepare(controlEnvelope, Date.now());
  expect(
    await repository.acceptReplay(
      await verifyWebhook({
        body: controlWire.body,
        headers: controlWire.headers,
        key,
        tenant: workspace,
        destinationId,
      }),
    ),
  ).toBe(true);
  await service.enqueue(controlEnvelope);
  expect((await service.dispatch(controlEvent!.id))?.state).toBe("uncertain");
  expect(
    (
      await f.call(
        "/settings/integrations/deliveries/" + controlEvent!.id + "/resolve",
        "POST",
        { kind: "rejected", evidenceCode: control.title },
      )
    ).status,
  ).toBe(200);
  async function historyRows(id: string) {
    const selectors: Record<string, string> = {
      vector_webhook_events: "id",
      integration_deliveries: "id",
      integration_attempts: "delivery_id",
      integration_resolutions: "delivery_id",
      integration_replays: "id",
    };
    return Object.fromEntries(
      await Promise.all(
        Object.entries(selectors).map(async ([table, column]) => [
          table,
          (
            await env.DB.prepare(
              `SELECT * FROM ${table} WHERE ${column}=? ORDER BY rowid`,
            )
              .bind(id)
              .all()
          ).results,
        ]),
      ),
    );
  }
  const plainReplay = {
    ...verified,
    envelope: {
      ...envelope,
      id: "plain-unrelated-replay",
      body: "non-JSON unrelated receiver content",
    },
    fingerprint: "plain-unrelated-fingerprint",
  };
  expect(await repository.acceptReplay(plainReplay)).toBe(true);
  const plainBefore = await env.DB.prepare(
    "SELECT * FROM integration_replays WHERE id=?",
  )
    .bind(plainReplay.envelope.id)
    .first();
  const targetBefore = await historyRows(event!.id),
    controlBefore = await historyRows(controlEvent!.id);
  for (const rows of [
    ...Object.values(targetBefore),
    ...Object.values(controlBefore),
  ])
    expect(rows).toHaveLength(1);
  expect(
    (
      await f.call("/issues/" + issue.identifier, "DELETE", {
        expectedVersion: issue.version,
        confirmed: true,
      })
    ).status,
  ).toBe(200);
  expect(await historyRows(controlEvent!.id)).toEqual(controlBefore);
  const targetAfter = await historyRows(event!.id);
  for (const rows of Object.values(targetAfter)) expect(rows).toHaveLength(1);
  expect(JSON.stringify(targetAfter)).not.toContain(issue.title);
  console.info(
    "issue-deletion-webhook-counts",
    JSON.stringify(
      Object.keys(targetBefore).map((table) => ({
        table,
        before: targetBefore[table].length,
        after: targetAfter[table].length,
        unrelated: controlBefore[table].length,
      })),
    ),
  );
  expect(await service.log(event!.id)).toEqual(before);
  const afterReplay = await env.DB.prepare(
    "SELECT * FROM integration_replays WHERE namespace=? AND id=?",
  )
    .bind(workspace, event!.id)
    .first<Record<string, unknown>>();
  expect(afterReplay).toEqual({
    ...replay,
    envelope: JSON.stringify({ ...envelope, body: "{}" }),
  });
  expect(
    await env.DB.prepare(
      "SELECT * FROM integration_resolutions WHERE namespace=? AND delivery_id=?",
    )
      .bind(workspace, event!.id)
      .first(),
  ).toEqual({
    ...resolution,
    outcome: JSON.stringify({ kind: "accepted", code: "issue_deleted" }),
  });
  expect((await service.get(event!.id))?.state).toBe("accepted");
  await expect(repository.acceptReplay(verified)).rejects.toThrow();
  await expect(
    repository.acceptReplay({
      ...verified,
      envelope: { ...envelope, id: "previously-unpublished-private-replay" },
    }),
  ).rejects.toThrow();
  expect(
    await env.DB.prepare("SELECT * FROM integration_replays WHERE id=?")
      .bind(plainReplay.envelope.id)
      .first(),
  ).toEqual(plainBefore);
  await expect(
    env.DB.prepare(
      "UPDATE integration_replays SET envelope=? WHERE namespace=? AND id=?",
    )
      .bind(JSON.stringify(envelope), workspace, event!.id)
      .run(),
  ).rejects.toThrow();
}
