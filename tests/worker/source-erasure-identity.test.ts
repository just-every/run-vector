import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { setupIntegrations } from "./integration-fixture";
import { erasedSourceIdentity } from "../../src/core/features/integrations/source-identity";
it.each(["live-first", "erased-first"])(
  "[INTAKE-002 ISSUE-010 BASE-DATA-003] raw source identity custody is independent: %s",
  async (order) => {
    const f = await setupIntegrations(),
      source = await f.source("all-raw-identities-" + order);
    const input = {
      teamId: f.initial.teams[0].id,
      title: "Private source record",
      sourceRecordId: order + "@example.test",
      sourceRevisionId: order + "-revision@example.test",
      observedAt: "2026-10-01T02:00:00Z",
    };
    const distinct = {
      ...input,
      sourceRecordId: await erasedSourceIdentity(input.sourceRecordId),
      sourceRevisionId: await erasedSourceIdentity(input.sourceRevisionId),
      title: "Independent raw identity",
    };
    const create = async (value: typeof input) => {
      const response = await f.signed(source, value);
      expect(response.status, await response.clone().text()).toBe(200);
      return response.json() as Promise<{ identifier: string }>;
    };
    const original = await create(input);
    const peer = order === "live-first" ? await create(distinct) : undefined;
    const current = (await (
      await f.call("/issues/" + original.identifier)
    ).json()) as { id: string; version: number };
    const response = await f.call("/issues/" + original.identifier, "DELETE", {
      expectedVersion: current.version,
      confirmed: true,
    });
    console.info("source-raw-identity-delete", order, response.status);
    expect(response.status, await response.clone().text()).toBe(200);
    const independent = peer ?? (await create(distinct));
    expect((await f.signed(source, distinct)).status).toBe(200);
    expect((await f.call("/issues/" + independent.identifier)).status).toBe(
      200,
    );
    const rotation = await f.call(
      "/settings/integrations/sources/" + source.id + "/rotate",
      "POST",
      { overlapHours: 0 },
    );
    expect(rotation.status).toBe(200);
    const rotated = (await rotation.json()) as { secret: string };
    source.secret = rotated.secret;
    f.restart();
    expect((await f.signed(source, input)).status).toBe(410);
    expect(
      (await f.signed(source, { ...input, title: "Conflicting payload" }))
        .status,
    ).toBe(409);
    expect(
      (await f.signed(source, { ...input, sourceRevisionId: "new-revision" }))
        .status,
    ).toBe(410);
    for (const table of ["vector_source_records", "vector_source_receipts"]) {
      const rows = (
        await env.DB.prepare("SELECT * FROM " + table + " WHERE issue_id=?")
          .bind(current.id)
          .all()
      ).results;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.erased === 1)).toBe(true);
      expect(JSON.stringify(rows)).not.toContain(input.sourceRecordId);
      expect(JSON.stringify(rows)).not.toContain(input.sourceRevisionId);
    }
    expect(
      (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  },
);
