import { expect, it } from "vitest";
import { defaultParseSearch, defaultStringifySearch } from "@tanstack/react-router";
import { issueListQuerySchema } from "../../src/core/features/issues/list-schema";
import { roleWorkspace, resetLimits } from "./role-fixture";
import { team } from "./sub-team-fixture";

it("[TEAM-006] parent lists accept boolean, string, quoted and encoded sub-team filters and reject garbage", async () => {
  const w = await roleWorkspace();
  const child = await team(w, "Filter child", "FILSUB", w.team.id);
  const parentIssue = await w.create({ teamId: w.team.id, title: "Parent filter issue" });
  const childIssue = await w.create({ teamId: child.id, title: "Child filter issue" });
  for (const include of [true, false]) {
    const plain = String(include);
    const quoted = JSON.stringify(plain);
    const encoded = encodeURIComponent(quoted);
    for (const value of [include, plain, quoted, encoded]) {
      expect(issueListQuerySchema.parse({ includeSubTeams: value }).includeSubTeams).toBe(plain);
    }
    // Exercise the actual router's stringification, not a manually rebuilt URL.
    const routerSearch = defaultStringifySearch({ team: w.team.id, includeSubTeams: plain });
    expect(issueListQuerySchema.parse(defaultParseSearch(routerSearch)).includeSubTeams).toBe(plain);
    for (const surface of [w.member.call, w.member.api]) {
      for (const search of [
        routerSearch,
        ...[plain, quoted, encoded].map(value => "?" + new URLSearchParams({ team: w.team.id, includeSubTeams: value })),
      ]) {
        await resetLimits();
        const response = await surface("/issues" + search);
        expect(response.status, search).toBe(200);
        const list = await response.json() as { issues: Array<{ identifier: string }> };
        expect(list.issues.map(issue => issue.identifier).sort()).toEqual(
          (include ? [parentIssue.identifier, childIssue.identifier] : [parentIssue.identifier]).sort(),
        );
      }
    }
  }
  for (const value of ["yes", "1", "null", "", '"garbage"', "%oops"]) {
    for (const surface of [w.member.call, w.member.api]) {
      await resetLimits();
      expect((await surface("/issues?" + new URLSearchParams({ team: w.team.id, includeSubTeams: value }))).status).toBe(400);
    }
  }
});
