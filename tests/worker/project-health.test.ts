import { expect, it } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { request } from "./base-auth-fixture";
import { contractWith } from "../contract-tags";
import type { ProjectDetail } from "../../src/core/features/projects";

contractWith(
  it,
  "PROJ-005",
  "project health applies precedence, terminal exclusions, date and active-cycle capacity rules through HTTP",
  async () => {
    const f = await setupAdministration();
    const team = f.initial.teams[0]!;
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const local = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 16);
    const json = async (path: string) => {
      const response = await f.call(path);
      expect(response.status, await response.clone().text()).toBe(200);
      return response.json() as Promise<
        ProjectDetail & { healthExplanation: string | null }
      >;
    };
    const state = await f.mutate("/settings/projects", "POST", {
      name: "Checkout resilience",
      leadOperatorId: f.owner,
    });
    const project = state.projects.find(
      (p) => p.name === "Checkout resilience",
    )!;
    const path = "/projects/" + project.id;
    const update = (body: object) =>
      f.mutate("/settings/projects/" + project.id, "PATCH", body);
    const read = () => json(path);
    expect((await read()).health).toBe("none");
    await update({ lifecycle: "active" });
    expect(await read()).toMatchObject({
      health: "unknown",
      healthExplanation: expect.stringContaining("target date"),
    });
    await update({ targetDate: day(0) });
    expect((await read()).health).toBe("unknown");
    await update({ targetDate: day(7) });
    expect((await read()).health).toBe("on-track");

    const cycleState = await f.mutate("/settings/cycles", "POST", {
      teamId: team.id,
      name: "Payment reliability",
      startsLocal: local(-1),
      endsLocal: local(5),
      capacity: 8,
    });
    const cycle = cycleState.cycles.find(
      (c) => c.name === "Payment reliability",
    )!;
    const issue = await f.create({
      projectId: project.id,
      cycleId: cycle.id,
      estimate: 8,
      assigneeOperatorId: f.owner,
    });
    const edit = async (identifier: string, body: object) => {
      const current = (await (
        await f.call("/issues/" + identifier)
      ).json()) as { version: number };
      const response = await f.call("/issues/" + identifier, "PATCH", {
        expectedVersion: current.version,
        ...body,
      });
      expect(response.status, await response.clone().text()).toBe(200);
    };
    expect((await read()).health).toBe("on-track"); // equality does not exceed capacity
    await edit(issue.identifier, { estimate: 9 });
    expect((await read()).health).toBe("at-risk");
    await edit(issue.identifier, { estimate: null });
    expect(await read()).toMatchObject({
      health: "unknown",
      healthExplanation: expect.stringContaining("estimates"),
    });
    await edit(issue.identifier, { estimate: 8 });
    const teamState = await f.mutate("/settings/teams", "POST", {
      name: "Infrastructure",
      identifierPrefix: "INFRA",
    });
    const secondTeam = teamState.teams.find(
      (t) => t.identifierPrefix === "INFRA",
    )!;
    const unbounded = await f.mutate("/settings/cycles", "POST", {
      teamId: secondTeam.id,
      name: "Shared infrastructure",
      startsLocal: local(-1),
      endsLocal: local(5),
    });
    const unknownCapacity = await f.create({
      teamId: secondTeam.id,
      projectId: project.id,
      cycleId: unbounded.cycles.find((c) => c.teamId === secondTeam.id)!.id,
      estimate: 1,
    });
    expect(await read()).toMatchObject({
      health: "unknown",
      healthExplanation: expect.stringContaining("capacity"),
    });
    await edit(unknownCapacity.identifier, { projectId: null });
    await edit(issue.identifier, {
      priority: "urgent",
      assigneeOperatorId: null,
    });
    expect((await read()).health).toBe("at-risk");
    await edit(issue.identifier, { assigneeOperatorId: f.owner });
    expect((await read()).health).toBe("on-track");

    const blocker = await f.create({ title: "Provider settlement agreement" });
    const link = await f.call(
      "/issues/" + issue.identifier + "/dependencies",
      "POST",
      {
        expectedVersion: (
          (await (await f.call("/issues/" + issue.identifier)).json()) as {
            version: number;
          }
        ).version,
        relatedIdentifier: blocker.identifier,
        relatedVersion: blocker.version,
        direction: "blocked-by",
      },
    );
    expect(link.status, await link.clone().text()).toBe(200);
    await update({ targetDate: day(-1) });
    expect((await read()).health).toBe("blocked"); // outranks an overdue target
    await edit(issue.identifier, { priority: "low" });
    expect((await read()).health).toBe("blocked"); // every remaining issue is blocked
    await f.create({ projectId: project.id, priority: "low" });
    expect((await read()).health).toBe("at-risk"); // only some non-urgent work is blocked
    await update({ targetDate: day(7) });
    expect((await read()).health).toBe("on-track");
    for (const category of ["completed", "canceled", "duplicate"]) {
      if (category === "duplicate") {
        const current = (await (
          await f.call("/issues/" + blocker.identifier)
        ).json()) as { version: number };
        const canonical = await f.create();
        const response = await f.call(
          "/issues/" + blocker.identifier + "/duplicate",
          "POST",
          {
            expectedVersion: current.version,
            canonicalIdentifier: canonical.identifier,
          },
        );
        expect(response.status, await response.clone().text()).toBe(200);
      } else {
        await edit(blocker.identifier, {
          statusId: team.statuses.find((s) => s.category === category)!.id,
        });
      }
      await edit(issue.identifier, { priority: "urgent" });
      expect((await read()).health).toBe("on-track"); // terminal blockers resolve the dependency
    }
    const futureState = await f.mutate("/settings/cycles", "POST", {
      teamId: team.id,
      name: "Next payment cycle",
      startsLocal: local(6),
      endsLocal: local(13),
    });
    await f.create({
      projectId: project.id,
      cycleId: futureState.cycles.find((c) => c.name === "Next payment cycle")!
        .id,
    });
    expect((await read()).health).toBe("on-track"); // future cycle unknowns are not current capacity exposure
    const completedStatus = team.statuses.find(
      (s) => s.category === "completed",
    )!.id;
    await edit(issue.identifier, {
      statusId: completedStatus,
      assigneeOperatorId: null,
      estimate: 100,
    });
    expect((await read()).health).toBe("on-track"); // completed scope cannot cause ownership/capacity risk
    for (const lifecycle of ["planned", "completed", "canceled"]) {
      await update({ lifecycle, targetDate: day(-1) });
      expect(await read()).toMatchObject({
        health: "none",
        risks: [],
        healthExplanation: null,
      });
      const portfolio = (await (await f.call("/projects")).json()) as {
        counts: Record<string, number>;
      };
      expect(portfolio.counts["at-risk"] ?? 0).toBe(0);
    }
    expect((await request("/api" + path)).status).toBe(401);
  },
);
