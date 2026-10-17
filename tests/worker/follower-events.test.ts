import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import type {
  InboxItem,
  InboxPage,
} from "../../src/core/features/notifications/schema";

type Issue = { id: string; identifier: string; version: number };
async function receipt<T>(response: Response, status = 200): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json() as Promise<T>;
}

contractWith(
  it,
  "NOTIFY-001 NOTIFY-002 NOTIFY-003",
  "followers receive atomic grouped issue changes with active subscriptions, mutes and actor exclusion",
  async () => {
    const f = await collaborationFixture(),
      team = f.initial.teams[0];
    const status = (category: string) =>
      team.statuses.find((row) => row.category === category)!.id;
    const actorName = (await f.state()).operators.find(
      (row) => row.id === f.bob,
    )!.name;
    const events = async (cookie: string, issue: Issue): Promise<InboxItem[]> =>
      (
        await receipt<InboxPage>(await f.any(cookie, "/notifications?limit=50"))
      ).items.filter((row) => row.identifier === issue.identifier);
    const edit = async (issue: Issue, changes: Record<string, unknown>) => {
      const next = await receipt<Issue>(
        await f.any(f.bobCookie, `/issues/${issue.identifier}`, "PATCH", {
          expectedVersion: issue.version,
          ...changes,
        }),
      );
      issue.version = next.version;
    };
    const subscription = async (
      cookie: string,
      issue: Issue,
      patch: Record<string, boolean>,
    ) => {
      await receipt(
        await f.any(
          cookie,
          `/issues/${issue.identifier}/subscription`,
          "PATCH",
          patch,
        ),
      );
    };

    const completed = await f.create({ statusId: status("unstarted") });
    await subscription(f.bobCookie, completed, { following: true });
    await edit(completed, { statusId: status("completed") });
    let ownerEvents = await events(f.cookie, completed);
    expect(ownerEvents).toHaveLength(1);
    expect(ownerEvents[0]).toMatchObject({
      actor: actorName,
      causes: ["completed"],
    });
    expect(await events(f.bobCookie, completed)).toEqual([]);
    expect(await events(f.caraCookie, completed)).toEqual([]);
    await receipt(
      await f.any(f.bobCookie, `/issues/${completed.identifier}`, "PATCH", {
        expectedVersion: 1,
        statusId: status("completed"),
      }),
      409,
    );
    await edit(completed, { statusId: status("completed") });
    expect(await events(f.cookie, completed)).toHaveLength(1);

    const canceled = await f.create();
    await edit(canceled, { statusId: status("canceled") });
    expect(await events(f.cookie, canceled)).toMatchObject([
      { actor: actorName, causes: ["canceled"] },
    ]);

    const grouped = await f.create({
      statusId: status("unstarted"),
      assigneeOperatorId: f.owner,
    });
    await subscription(f.caraCookie, grouped, { following: true });
    await receipt(
      await f.any(f.caraCookie, "/settings/notifications", "PATCH", {
        mutedKinds: ["status"],
      }),
    );
    await edit(grouped, {
      statusId: status("started"),
      priority: "urgent",
      dueDate: "2099-06-01",
    });
    ownerEvents = await events(f.cookie, grouped);
    expect(ownerEvents).toHaveLength(1);
    expect(ownerEvents[0].actor).toBe(actorName);
    expect(ownerEvents[0].causes.toSorted()).toEqual([
      "due_changed",
      "status",
      "urgent",
    ]);
    const caraEvents = await events(f.caraCookie, grouped);
    expect(caraEvents).toHaveLength(1);
    expect(caraEvents[0].causes.toSorted()).toEqual(["due_changed", "urgent"]);
    expect(caraEvents[0].eventId).toBe(ownerEvents[0].eventId);
    await subscription(f.caraCookie, grouped, { muted: true });
    await edit(grouped, { dueDate: null });
    expect((await events(f.cookie, grouped))[0].causes).toEqual([
      "due_changed",
    ]);
    expect(await events(f.caraCookie, grouped)).toHaveLength(1);
    await subscription(f.caraCookie, grouped, {
      muted: false,
      following: false,
    });
    await edit(grouped, { dueDate: "2099-06-02" });
    expect(await events(f.caraCookie, grouped)).toHaveLength(1);

    const blocker = await f.create({ statusId: status("unstarted") });
    const dependency = async (method: string) => {
      const result = await receipt<{ issue: Issue; relatedIssue: Issue }>(
        await f.any(
          f.bobCookie,
          `/issues/${grouped.identifier}/dependencies`,
          method,
          {
            expectedVersion: grouped.version,
            relatedIdentifier: blocker.identifier,
            relatedVersion: blocker.version,
            direction: "blocked-by",
          },
        ),
      );
      grouped.version = result.issue.version;
      blocker.version = result.relatedIssue.version;
    };
    await dependency("POST");
    const blockedEvent = (await events(f.cookie, grouped))[0];
    expect(blockedEvent.causes).toEqual(["blocking"]);
    const blockerEvents = await events(f.cookie, blocker);
    expect(blockerEvents).toHaveLength(1);
    expect(blockerEvents[0]).toMatchObject({
      causes: ["blocking"],
      eventId: blockedEvent.eventId,
    });
    await dependency("DELETE");
    expect((await events(f.cookie, grouped))[0].causes.toSorted()).toEqual([
      "blocking",
      "unblocked",
    ]);
    expect((await events(f.cookie, blocker))[0].causes).toEqual(["blocking"]);

    const duplicate = await f.create();
    const marked = await receipt<Issue>(
      await f.any(
        f.bobCookie,
        `/issues/${duplicate.identifier}/duplicate`,
        "POST",
        {
          expectedVersion: duplicate.version,
          canonicalIdentifier: blocker.identifier,
        },
      ),
    );
    duplicate.version = marked.version;
    expect(await events(f.cookie, duplicate)).toMatchObject([
      { causes: ["duplicate"], actor: actorName },
    ]);
    await receipt(
      await f.any(
        f.bobCookie,
        `/issues/${duplicate.identifier}/duplicate`,
        "POST",
        { expectedVersion: duplicate.version, canonicalIdentifier: null },
      ),
    );
    expect((await events(f.cookie, duplicate))[0].causes).toEqual(["status"]);

    const intake = await receipt<Issue>(
      await f.call("/intake", "POST", {
        title: "Followed intake",
        teamId: team.id,
      }),
      201,
    );
    await receipt(
      await f.any(f.bobCookie, `/issues/${intake.identifier}/decline`, "POST", {
        expectedVersion: intake.version,
        reason: "Outside the work scope",
      }),
    );
    expect(await events(f.cookie, intake)).toMatchObject([
      { causes: ["canceled"], actor: actorName },
    ]);

    const selection = [grouped, blocker].map((issue) => ({
      identifier: issue.identifier,
      expectedVersion: issue.version,
    }));
    const bulk = await receipt<{
      issues: { identifier: string; version: number }[];
    }>(
      await f.any(f.bobCookie, "/issues/bulk", "POST", {
        issues: selection,
        changes: { statusId: status("completed"), priority: "urgent" },
      }),
    );
    expect((await events(f.cookie, grouped))[0].causes).toEqual(["completed"]);
    expect((await events(f.cookie, blocker))[0].causes.toSorted()).toEqual([
      "completed",
      "urgent",
    ]);
    const before = await count("notifications");
    await receipt(
      await f.any(f.bobCookie, "/issues/bulk", "POST", {
        issues: bulk.issues.map((issue) => ({
          identifier: issue.identifier,
          expectedVersion: issue.version,
        })),
        changes: { statusId: status("completed"), priority: "urgent" },
      }),
    );
    expect(await count("notifications")).toBe(before);
    // Mapping a completed issue into another team's completed status is a
    // status change, never a second completion notification.
    await receipt(await f.call('/settings/teams', 'POST', { name: 'Checkout follow-up', identifierPrefix: 'CHK' }));
    const otherTeam = (await f.state()).teams.find(row => row.identifierPrefix === 'CHK')!;
    const movedIssue = await f.create({ statusId: status('completed') });
    await receipt(await f.any(f.bobCookie, `/issues/${movedIssue.identifier}/team`, 'POST', {
      expectedVersion: movedIssue.version, teamId: otherTeam.id,
      statusId: otherTeam.statuses.find(row => row.category === 'completed')!.id,
    }));
    expect(await events(f.cookie, movedIssue)).toMatchObject([{ causes: ['status'], actor: actorName }]);
    expect(await events(f.bobCookie, movedIssue)).toHaveLength(0);
    expect(await count("notification_deliveries")).toBe(0);
    expect(await count("notification_candidates")).toBe(0);
  },
);
