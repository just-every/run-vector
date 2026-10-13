import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
contractWith(
  it,
  "NOTIFY-001 NOTIFY-003",
  "cross-team cancellation and intake decline resolve the last blocker, with actor suppression and reverse-direction edge removal",
  async () => {
    const f = await collaborationFixture();
    const admin = await f.mutate("/settings/teams", "POST", {
      name: "Other team",
      identifierPrefix: "OTHR",
    });
    const other = admin.teams.find((t) => t.identifierPrefix === "OTHR")!;
    const dependent = await f.create({
        teamId: other.id,
        assigneeOperatorId: f.bob,
      }),
      a = await f.create();
    async function edge(
      blocking: string,
      blocked: string,
      method: string,
      reverse = false,
    ) {
      const source = await f.data(
          f.cookie,
          `/issues/${reverse ? blocked : blocking}`,
        ),
        related = await f.data(
          f.cookie,
          `/issues/${reverse ? blocking : blocked}`,
        );
      const response = await f.call(
        `/issues/${source.identifier}/dependencies`,
        method,
        {
          expectedVersion: source.version,
          relatedVersion: related.version,
          relatedIdentifier: related.identifier,
          direction: reverse ? "blocked-by" : "blocks",
        },
      );
      expect(response.status, await response.clone().text()).toBe(200);
    }
    await edge(a.identifier, dependent.identifier, "POST");
    let item = await f.data(f.cookie, `/issues/${a.identifier}`);
    expect(
      (
        await f.call(`/issues/${a.identifier}`, "PATCH", {
          expectedVersion: item.version,
          statusId: f.initial.teams[0].statuses.find(
            (s) => s.category === "canceled",
          )!.id,
        })
      ).status,
    ).toBe(200);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      1,
    );
    const response = await f.call("/intake", "POST", {
        title: "Declined blocker",
        teamId: f.initial.teams[0].id,
      }),
      intake = (await response.json()) as { identifier: string };
    await edge(intake.identifier, dependent.identifier, "POST");
    item = await f.data(f.cookie, `/issues/${intake.identifier}`);
    expect(
      (
        await f.call(`/issues/${intake.identifier}/decline`, "POST", {
          expectedVersion: item.version,
          reason: "No action",
        })
      ).status,
    ).toBe(200);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      2,
    );
    const last = await f.create();
    await edge(last.identifier, dependent.identifier, "POST");
    await edge(last.identifier, dependent.identifier, "DELETE", true);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      3,
    );
    const own = await f.create({ assigneeOperatorId: f.owner }),
      block = await f.create();
    await edge(block.identifier, own.identifier, "POST");
    await edge(block.identifier, own.identifier, "DELETE", true);
    expect(await count("notifications", "causes_json LIKE '%unblocked%'")).toBe(
      3,
    );
  },
);
