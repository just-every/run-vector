import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { setupIntegrations } from "./integration-fixture";
import { bindings } from "./base-auth-fixture";
import {
  outboundService,
  dispatchWebhooks,
} from "../../src/core/features/integrations/outbound";
import { beforeCommit } from "./removal-interleaving";
it("[ISSUE-010 WEBHOOK-001 WEBHOOK-002] erased queued, terminal and preloaded events retain delivery evidence but cannot submit or restore private payloads", async () => {
  const f = await setupIntegrations();
  const response = await f.call("/settings/integrations/destinations", "POST", {
    name: "Erasure proof",
    url: "https://receiver.example.com/events",
  });
  expect(response.status).toBe(201);
  const destination = (await response.json()) as { id: string };
  const workspace = await env.DB.prepare(
    "SELECT workspace_id FROM operators WHERE id=?",
  )
    .bind(f.owner)
    .first<string>("workspace_id");
  let calls = 0;
  const current = {
    ...bindings,
    INTEGRATION_EGRESS_POLICY: "public-dns-pinned-tls-v1",
    INTEGRATION_EGRESS: {
      async send(wire: { body: string }) {
        calls++;
        return { status: 200, headers: {}, body: wire.body };
      },
    },
  };
  const service = outboundService(current, workspace!);
  const issue = await f.create({ title: "Private outbound erasure" });
  const token = await f.issueToken(["issues:write"]);
  expect(
    (
      await f.api(token.token, "/issues/" + issue.identifier, "DELETE", {
        expectedVersion: issue.version,
        confirmed: true,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await f.app.request(
        bindings.APP_ORIGIN + "/api/issues/" + issue.identifier,
        {
          method: "DELETE",
          headers: {
            origin: bindings.APP_ORIGIN,
            authorization: "Bearer " + token.token,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: issue.version,
            confirmed: true,
          }),
        },
        bindings,
      )
    ).status,
  ).toBe(401);
  const event = await env.DB.prepare(
    "SELECT id,event,body FROM vector_webhook_events WHERE json_extract(body,'$.identifier')=?",
  )
    .bind(issue.identifier)
    .first<{ id: string; event: string; body: string }>();
  const envelope = {
    id: event!.id,
    tenant: workspace!,
    destinationId: destination.id,
    event: event!.event,
    protocol: "webhook",
    body: event!.body,
  };
  await service.enqueue(envelope);
  await service.dispatch(envelope.id);
  expect(calls).toBe(1);
  const attempts = await env.DB.prepare(
    "SELECT * FROM integration_attempts ORDER BY id",
  ).all();
  expect(
    (
      await f.call("/issues/" + issue.identifier, "DELETE", {
        expectedVersion: issue.version,
        confirmed: true,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await env.DB.prepare(
        "SELECT * FROM integration_attempts ORDER BY id",
      ).all()
    ).results,
  ).toEqual(attempts.results);
  expect(
    await env.DB.prepare("SELECT body FROM vector_webhook_events WHERE id=?")
      .bind(event!.id)
      .first<string>("body"),
  ).toBe("{}");
  expect(
    JSON.parse(
      (await env.DB.prepare(
        "SELECT envelope FROM integration_deliveries WHERE id=?",
      )
        .bind(event!.id)
        .first<string>("envelope"))!,
    ).body,
  ).toBe("{}");
  expect((await service.get(event!.id))?.state).toBe("accepted");
  await expect(service.enqueue(envelope)).rejects.toThrow();
  await service.dispatch(event!.id);
  expect(calls).toBe(1);
  const waiting = await f.create({ title: "Queued private payload" });
  const waitingEvent = await env.DB.prepare(
    "SELECT id FROM vector_webhook_events WHERE json_extract(body,'$.identifier')=?",
  )
    .bind(waiting.identifier)
    .first<{ id: string }>();
  const DB = beforeCommit(
    (sql) => sql.includes("INSERT INTO integration_deliveries"),
    async () => {
      expect(
        (
          await f.call("/issues/" + waiting.identifier, "DELETE", {
            expectedVersion: waiting.version,
            confirmed: true,
          })
        ).status,
      ).toBe(200);
    },
  );
  expect((await dispatchWebhooks({ ...current, DB })).enqueued).toBe(0);
  expect(calls).toBe(1);
  expect(
    await env.DB.prepare("SELECT 1 FROM integration_deliveries WHERE id=?")
      .bind(waitingEvent!.id)
      .first(),
  ).toBeNull();
  const prepared = await f.create({ title: "Wire prepared before erasure" });
  const preparedEvent = await env.DB.prepare(
    "SELECT id,event,body FROM vector_webhook_events WHERE json_extract(body,'$.identifier')=?",
  )
    .bind(prepared.identifier)
    .first<{ id: string; event: string; body: string }>();
  await service.enqueue({
    id: preparedEvent!.id,
    tenant: workspace!,
    destinationId: destination.id,
    event: preparedEvent!.event,
    protocol: "webhook",
    body: preparedEvent!.body,
  });
  let reads = 0;
  const transportRace = beforeCommit(
    (sql) => sql.includes("SELECT * FROM integration_deliveries"),
    async () => {
      if (++reads !== 2) return;
      expect(
        (
          await f.call("/issues/" + prepared.identifier, "DELETE", {
            expectedVersion: prepared.version,
            confirmed: true,
          })
        ).status,
      ).toBe(200);
    },
    false,
  );
  const fenced = await outboundService(
    { ...current, DB: transportRace },
    workspace!,
  ).dispatch(preparedEvent!.id);
  expect(reads).toBeGreaterThanOrEqual(2);
  expect(fenced?.state).toBe("uncertain");
  expect(calls).toBe(1);
  expect(await service.log(preparedEvent!.id)).toHaveLength(1);
  const inflight = await f.create({ title: "Already invoked private payload" });
  const inFlightEdge = {
    ...current,
    INTEGRATION_EGRESS: {
      async send(wire: { body: string }) {
        calls++;
        expect(
          (
            await f.call("/issues/" + inflight.identifier, "DELETE", {
              expectedVersion: inflight.version,
              confirmed: true,
            })
          ).status,
        ).toBe(200);
        return { status: 200, headers: {}, body: wire.body };
      },
    },
  };
  await dispatchWebhooks(inFlightEdge);
  expect(calls).toBe(2);
  await dispatchWebhooks(current);
  expect(calls).toBe(2);
  for (const row of (
    await env.DB.prepare("SELECT envelope FROM integration_deliveries").all<{
      envelope: string;
    }>()
  ).results)
    expect(JSON.parse(row.envelope).body).toBe("{}");
  const { proveWebhookHistory } =
    await import("./issue-deletion-webhook-history");
  await proveWebhookHistory(f, current, workspace!, destination.id);
  // Resolution after deletion must also discard operator-entered evidence codes.
  expect(
    (
      await f.call(
        "/settings/integrations/deliveries/" + preparedEvent!.id + "/resolve",
        "POST",
        { kind: "rejected", evidenceCode: "Late_private_customer_evidence" },
      )
    ).status,
  ).toBe(200);
  const retained = (
    await env.DB.prepare(
      "SELECT r.outcome FROM integration_resolutions r JOIN vector_webhook_erasures e ON e.namespace=r.namespace AND e.id=r.delivery_id",
    ).all<{
      outcome: string;
    }>()
  ).results;
  expect(retained).toHaveLength(2);
  for (const row of retained)
    expect(JSON.parse(row.outcome).code).toBe("issue_deleted");
  const attemptsAfterEcho = (
    await env.DB.prepare("SELECT outcome FROM integration_attempts").all<{
      outcome: string;
    }>()
  ).results;
  for (const row of attemptsAfterEcho) {
    const outcome = JSON.parse(row.outcome);
    expect(Object.keys(outcome).sort()).toEqual(
      ["code", "kind", "status"].filter(
        (key) => key !== "status" || outcome.status !== undefined,
      ),
    );
  }
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
}, 180000);
it("[ISSUE-010 WEBHOOK-002 BASE-DATA-003] a public delivery reconciliation invalidates prepared native erasure and its terminal decision survives re-preparation", async () => {
  const { request } = await import("./base-auth-fixture");
  const f = await setupIntegrations();
  const destinationResponse = await f.call(
    "/settings/integrations/destinations",
    "POST",
    {
      name: "Prepared erasure reconciliation",
      url: "https://receiver.example.com/late",
    },
  );
  expect(destinationResponse.status).toBe(201);
  const destination = (await destinationResponse.json()) as { id: string };
  const issue = await f.create({ title: "Private late reconciliation" });
  const event = await env.DB.prepare(
    "SELECT id,event,body,workspace_id FROM vector_webhook_events WHERE json_extract(body,'$.identifier')=? AND destination_id=?",
  )
    .bind(issue.identifier, destination.id)
    .first<{ id: string; event: string; body: string; workspace_id: string }>();
  const service = outboundService(
    {
      ...bindings,
      INTEGRATION_EGRESS_POLICY: "public-dns-pinned-tls-v1",
      INTEGRATION_EGRESS: {
        async send() {
          return { status: 503, headers: {}, body: "" };
        },
      },
    },
    event!.workspace_id,
  );
  await service.enqueue({
    id: event!.id,
    tenant: event!.workspace_id,
    destinationId: destination.id,
    event: event!.event,
    protocol: "webhook",
    body: event!.body,
  });
  expect((await service.dispatch(event!.id))?.state).toBe("uncertain");
  const DB = beforeCommit(
    (sql) => sql.includes("DELETE FROM issues"),
    async () => {
      expect(
        (
          await f.call(
            "/settings/integrations/deliveries/" + event!.id + "/resolve",
            "POST",
            { kind: "accepted", evidenceCode: "Private_late_resolution" },
          )
        ).status,
      ).toBe(200);
    },
  );
  const response = await request(
    "/api/issues/" + issue.identifier,
    "DELETE",
    { expectedVersion: issue.version, confirmed: true },
    f.cookie,
    { DB },
  );
  expect(response.status, await response.clone().text()).toBe(409);
  expect((await f.call("/issues/" + issue.identifier)).status).toBe(200);
  expect((await service.get(event!.id))?.state).toBe("accepted");
  expect(
    (
      await f.call("/issues/" + issue.identifier, "DELETE", {
        expectedVersion: issue.version,
        confirmed: true,
      })
    ).status,
  ).toBe(200);
  expect((await service.get(event!.id))?.state).toBe("accepted");
  expect(
    JSON.stringify(
      (
        await env.DB.prepare(
          "SELECT outcome FROM integration_resolutions WHERE delivery_id=?",
        )
          .bind(event!.id)
          .all()
      ).results,
    ),
  ).not.toContain("Private_late_resolution");
});
