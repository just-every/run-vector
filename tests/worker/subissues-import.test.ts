import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import type { SubissuesData } from "../../src/core/features/subissues/schema";
import { setupImport } from "./data-import-fixture";
import { receipt, type Detail } from "./subissues-fixture";
contractWith(
  it,
  "ISSUE-019 BASE-DATA-001",
  "mapped historical hierarchy import does not replay team completion automation",
  async () => {
    const f = await setupImport(),
      done = f.team.statuses.find((s) => s.category === "completed")!;
    const rule = await receipt<{ version: number }>(
      await f.call(`/teams/${f.team.id}/subissue-rule`),
    );
    await receipt(
      await f.call(`/teams/${f.team.id}/subissue-rule`, "PATCH", {
        expectedVersion: rule.version,
        enabled: true,
      }),
    );
    await f.publish(
      f.input(
        [
          f.row("parent", {
            title: "Historical completed parent",
            status: done.name,
          }),
          f.row("child", {
            title: "Historical unfinished child",
            parent: "parent",
          }),
        ],
        "subissue-history",
      ),
    );
    const parent = await env.DB.prepare(
      "SELECT identifier,version FROM issues WHERE title='Historical completed parent'",
    ).first<{ identifier: string; version: number }>();
    expect(parent).not.toBeNull();
    const detail = await receipt<Detail>(
      await f.call(`/issues/${parent!.identifier}`),
    );
    const state = await receipt<SubissuesData>(
      await f.call(`/issues/${parent!.identifier}/subissues`),
    );
    expect(detail.status.category).toBe("completed");
    expect(state.total).toBe(1);
    expect(state.completed).toBe(0);
    expect(
      detail.activity.some((a) => a.kind.startsWith("issue.subissue_")),
    ).toBe(false);
  },
);
