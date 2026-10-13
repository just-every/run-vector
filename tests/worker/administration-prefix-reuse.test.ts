import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { setupAdministration } from "./administration-fixture";
import { allocateIssueSequence } from "../../src/core/features/issues/create-guard";
import { creationCounts, prefixSequence, sequence } from "./administration-prefix-fixture";

let fixture: Awaited<ReturnType<typeof setupAdministration>>;
beforeAll(async () => { fixture = await setupAdministration(); });

contractWith(it, "TEAM-001 ISSUE-002", "AB-1 and CD-1 reservations survive prefix changes before AB-2 and AB-3 commit", async () => {
  const f = fixture;
  const team = (await f.mutate("/settings/teams", "POST", {
    name: "Reusable prefix", identifierPrefix: "AB",
  })).teams.find((t) => t.identifierPrefix === "AB")!;
  const reserve = () => allocateIssueSequence(
    env.DB, f.owner, f.initial.workspace.id, team.id, new Date().toISOString(),
  );
  expect(await reserve()).toEqual({ prefix: "AB", sequence: 1 });
  await f.mutate("/settings/teams/" + team.id, "PATCH", { identifierPrefix: "CD" });
  expect(await reserve()).toEqual({ prefix: "CD", sequence: 1 });
  await f.mutate("/settings/teams/" + team.id, "PATCH", { identifierPrefix: "AB" });
  expect(await sequence(team.id)).toBe(1);
  expect(await creationCounts(team.id)).toEqual({ issues: 0, evidence: 0, activity: 0, history: 0 });
  const second = await f.create({ teamId: team.id });
  const third = await f.create({ teamId: team.id });
  expect(second.identifier).toBe("AB-2");
  expect(third.identifier).toBe("AB-3");
  expect(await sequence(team.id)).toBe(3);
  expect(await prefixSequence("AB")).toBe(3);
  expect(await prefixSequence("CD")).toBe(1);
  expect((await f.call("/issues/AB-1")).status).toBe(404);
  expect((await f.call("/issues/CD-1")).status).toBe(404);
  expect(await creationCounts(team.id)).toEqual({ issues: 2, evidence: 0, activity: 2, history: 1 });
  expect((await f.state()).teams.find((t) => t.id === team.id)!.prefixEditable).toBe(false);
});
