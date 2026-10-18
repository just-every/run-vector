import { expect, it } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { contractWith } from "../contract-tags";
import type { ProjectDetail } from "../../src/core/features/projects";

contractWith(
  it,
  "PROJ-006",
  "risk evidence identifies precise blockers and retains concurrent date, ownership and capacity exposure",
  async () => {
    const f = await setupAdministration(),
      team = f.initial.teams[0]!;
    const local = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString().slice(0, 16);
    const state = await f.mutate("/settings/projects", "POST", {
      name: "Payment reliability rollout",
      leadOperatorId: f.owner,
      targetDate: local(-1).slice(0, 10),
    });
    const project = state.projects.find(
      (p) => p.name === "Payment reliability rollout",
    )!;
    await f.mutate("/settings/projects/" + project.id, "PATCH", {
      lifecycle: "active",
    });
    const cycles = await f.mutate("/settings/cycles", "POST", {
      teamId: team.id,
      name: "Payment recovery",
      startsLocal: local(-1),
      endsLocal: local(6),
      capacity: 8,
    });
    const cycle = cycles.cycles.find((c) => c.name === "Payment recovery")!;
    const urgent = await f.create({
      projectId: project.id,
      title: "Recover rejected payment confirmations",
      cycleId: cycle.id,
      estimate: 8,
      priority: "urgent",
    });
    const other = await f.create({
      projectId: project.id,
      title: "Explain provider retry outcomes",
      cycleId: cycle.id,
      estimate: 5,
      assigneeOperatorId: f.owner,
      priority: "low",
    });
    const blocker = await f.create({
      title: "Approve provider signature rotation",
    });
    const otherBlocker = await f.create({
      title: "Agree the retry message wording",
    });
    const link = async (issue: typeof urgent, blocks: typeof blocker) => {
      const response = await f.call(
        "/issues/" + issue.identifier + "/dependencies",
        "POST",
        {
          expectedVersion: issue.version,
          relatedIdentifier: blocks.identifier,
          relatedVersion: blocks.version,
          direction: "blocked-by",
        },
      );
      expect(response.status, await response.clone().text()).toBe(200);
    };
    await link(urgent, blocker);
    await link(other, otherBlocker);
    const read = async () => {
      const response = await f.call("/projects/" + project.id);
      expect(response.status, await response.clone().text()).toBe(200);
      return response.json() as Promise<ProjectDetail>;
    };
    const blocked = await read();
    expect(blocked.health).toBe("blocked");
    expect(blocked.risks.map((r) => r.kind).sort()).toEqual([
      "capacity",
      "target-date",
      "unassigned-urgent",
      "unresolved-dependency",
    ]);
    const dependency = blocked.risks.find(
      (r) => r.kind === "unresolved-dependency",
    )!;
    expect(dependency.issueIdentifiers).toEqual([urgent.identifier]);
    expect(dependency.dependencyLinks).toEqual([
      {
        blockedIdentifier: urgent.identifier,
        blockingIdentifier: blocker.identifier,
      },
    ]);
    expect(
      blocked.risks.find((r) => r.kind === "unassigned-urgent")!
        .issueIdentifiers,
    ).toEqual([urgent.identifier]);
    expect(
      blocked.risks
        .find((r) => r.kind === "target-date")!
        .issueIdentifiers?.sort(),
    ).toEqual([urgent.identifier, other.identifier].sort());
    expect(blocked.risks.find((r) => r.kind === "capacity")).toMatchObject({
      issueIdentifiers: expect.arrayContaining([
        urgent.identifier,
        other.identifier,
      ]),
      capacity: {
        cycleId: cycle.id,
        estimatedPoints: 13,
        capacityPoints: 8,
        unestimatedIssueCount: 0,
      },
    });
    // With no urgent blocked issue, every remaining issue is the trigger.
    const setPriority = async (priority: string) => {
      const current = (await (
        await f.call("/issues/" + urgent.identifier)
      ).json()) as { version: number };
      const response = await f.call("/issues/" + urgent.identifier, "PATCH", {
        expectedVersion: current.version,
        priority,
      });
      expect(response.status, await response.clone().text()).toBe(200);
    };
    await setPriority("low");
    const allBlocked = (await read()).risks.find(
      (r) => r.kind === "unresolved-dependency",
    )!;
    expect(allBlocked.issueIdentifiers?.sort()).toEqual(
      [urgent.identifier, other.identifier].sort(),
    );
    expect(allBlocked.dependencyLinks).toEqual(
      expect.arrayContaining([
        {
          blockedIdentifier: urgent.identifier,
          blockingIdentifier: blocker.identifier,
        },
        {
          blockedIdentifier: other.identifier,
          blockingIdentifier: otherBlocker.identifier,
        },
      ]),
    );
    await setPriority("urgent");
    // Resolving one blocker removes that trigger without hiding the other risks.
    const latest = (await (
      await f.call("/issues/" + blocker.identifier)
    ).json()) as { version: number };
    const resolved = await f.call("/issues/" + blocker.identifier, "PATCH", {
      expectedVersion: latest.version,
      statusId: team.statuses.find((s) => s.category === "completed")!.id,
    });
    expect(resolved.status, await resolved.clone().text()).toBe(200);
    const atRisk = await read();
    expect(atRisk.health).toBe("at-risk");
    expect(atRisk.risks.map((r) => r.kind).sort()).toEqual([
      "capacity",
      "target-date",
      "unassigned-urgent",
    ]);
    expect(
      atRisk.dependencies.find(
        (d) => d.blockingIssue.identifier === blocker.identifier,
      )?.unresolved,
    ).toBe(false);
  },
);
