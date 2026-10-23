import {exerciseSubjectSubscriptions} from './subscriptions-scenario';
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
  "NOTIFY-001 NOTIFY-002 NOTIFY-003 NOTIFY-004 NOTIFY-009",
  "followers receive grouped issue changes and participated thread reopens with mutes and actor exclusion",
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

    const threaded = await f.create({ title: "Reopened discussion" });
    const post = async (cookie: string, body: string, parentId?: string) =>
      (await receipt<{ id: string }>(
        await f.any(cookie, `/issues/${threaded.identifier}/comments`, "POST", {
          body, ...(parentId ? { parentId } : {}),
        }), 201,
      )).id;
    const root = await post(f.cookie, "Can we reproduce this?");
    await post(f.bobCookie, "Yes, on the latest build", root);
    // An author in another thread follows the issue but does not participate
    // in this thread and must not receive its reopened notification.
    await post(f.caraCookie, "A separate discussion");
    const resolution = async (cookie: string, resolved: boolean) =>
      receipt(await f.any(cookie, `/issues/${threaded.identifier}/comments/${root}/resolution`, "POST", { resolved }));
    const reopens = async (cookie: string) =>
      (await events(cookie, threaded)).filter(row => row.causes.includes("thread_reopened"));

    await resolution(f.cookie, false);
    expect(await reopens(f.bobCookie)).toEqual([]);
    await resolution(f.cookie, true);
    await resolution(f.cookie, false);
    const ownerName = (await f.state()).operators.find(row => row.id === f.owner)!.name;
    expect(await reopens(f.bobCookie)).toMatchObject([
      { actor: ownerName, causes: ["thread_reopened"] },
    ]);
    expect(await reopens(f.cookie)).toEqual([]);
    expect(await reopens(f.caraCookie)).toEqual([]);
    await resolution(f.cookie, false);
    expect(await reopens(f.bobCookie)).toHaveLength(1);

    // Both a top-level author and a reply author are participants. Each actual
    // reopen gets its own receipt, with the current actor excluded.
    await resolution(f.cookie, true);
    await resolution(f.bobCookie, false);
    expect(await reopens(f.cookie)).toMatchObject([
      { actor: actorName, causes: ["thread_reopened"] },
    ]);
    expect(await reopens(f.bobCookie)).toHaveLength(1);
    await resolution(f.cookie, true);
    await post(f.cookie, "A new reply reopens the resolved thread", root);
    const replyReopens = await reopens(f.bobCookie);
    expect(replyReopens).toHaveLength(2);
    expect(replyReopens.every(row => row.actor === ownerName)).toBe(true);
    expect(new Set(replyReopens.map(row => row.eventId)).size).toBe(2);
    expect(await reopens(f.cookie)).toHaveLength(1);
    expect(await reopens(f.caraCookie)).toEqual([]);
    await post(f.cookie, "Another reply while already open", root);
    await resolution(f.cookie, false);
    expect(await reopens(f.bobCookie)).toHaveLength(2);

    // Type mutes suppress future reopens without changing following; a former
    // participant who unfollows does not receive subsequent reopens either.
    const muted = await receipt<{ mutedKinds: string[] }>(
      await f.any(f.bobCookie, "/settings/notifications", "PATCH", {
        mutedKinds: ["thread_reopened"],
      }),
    );
    expect(muted.mutedKinds).toContain("thread_reopened");
    await resolution(f.cookie, true);
    await resolution(f.cookie, false);
    expect(await reopens(f.bobCookie)).toHaveLength(2);
    await receipt(await f.any(f.bobCookie, "/settings/notifications", "PATCH", { mutedKinds: [] }));
    await subscription(f.bobCookie, threaded, { following: false });
    await resolution(f.cookie, true);
    await resolution(f.cookie, false);
    expect(await reopens(f.bobCookie)).toHaveLength(2);
    expect(await reopens(f.cookie)).toHaveLength(1);
    expect(await reopens(f.caraCookie)).toEqual([]);
    expect(await count("notification_deliveries")).toBe(0);
    expect(await count("notification_candidates")).toBe(0);
  },
);


contractWith(
  it,
  "TEAM-004 NOTIFY-001 NOTIFY-003 NOTIFY-004",
  "workflow status removal notifies followers once without replaying terminal completion",
  async () => {
    const f = await collaborationFixture();
    const team = f.initial.teams[0];
    const actorName = (await f.state()).operators.find(row => row.id === f.bob)!.name;
    type MappedIssue = Issue & {
      status: { id: string; category: string };
      completedAt: string | null;
      canceledAt: string | null;
      activity: { id: string; kind: string; previousValue: unknown; nextValue: unknown }[];
    };
    const detail = (issue: Issue) =>
      f.call(`/issues/${issue.identifier}`).then(response => receipt<MappedIssue>(response));
    const events = async (cookie: string, issue: Issue) =>
      (await receipt<InboxPage>(await f.any(cookie, "/notifications?limit=50")))
        .items.filter(row => row.identifier === issue.identifier);
    await receipt(await f.any(f.caraCookie, "/settings/notifications", "PATCH", {
      mutedKinds: ["status"],
    }));
    // Bob removes statuses below; workflow editing is an Admin's (ROLE-001).
    await receipt(await f.call(`/settings/operators/${f.bob}/role`, "PATCH", { role: "admin" }));

    for (const category of ["unstarted", "completed", "canceled"]) {
      const destination = team.statuses.find(row => row.category === category)!;
      const name = `Alternative ${category}`;
      const administration = await f.mutate(`/settings/teams/${team.id}/statuses`, "POST", {
        name, category,
      });
      const removed = administration.teams.find(row => row.id === team.id)!
        .statuses.find(row => row.name === name)!;
      const issues = await Promise.all([
        f.create({ statusId: removed.id }),
        f.create({ statusId: removed.id }),
      ]);
      for (const issue of issues) {
        for (const cookie of [f.bobCookie, f.caraCookie]) {
          await receipt(await f.any(cookie, `/issues/${issue.identifier}/subscription`, "PATCH", {
            following: true,
          }));
        }
      }
      const before = await Promise.all(issues.map(detail));
      if (category === "completed")
        expect(before.every(issue => typeof issue.completedAt === "string")).toBe(true);
      if (category === "canceled")
        expect(before.every(issue => typeof issue.canceledAt === "string")).toBe(true);

      const path = `/settings/teams/${team.id}/statuses/${removed.id}`;
      await receipt(await f.any(f.bobCookie, path, "DELETE", {
        destinationStatusId: destination.id,
      }));
      const after = await Promise.all(issues.map(detail));
      for (let index = 0; index < issues.length; index++) {
        const issue = issues[index];
        expect(after[index]).toMatchObject({
          status: { id: destination.id, category },
          version: before[index].version + 1,
          completedAt: before[index].completedAt,
          canceledAt: before[index].canceledAt,
        });
        const activity = after[index].activity.filter(row => row.kind === "workflow.status_removed");
        expect(activity).toHaveLength(1);
        expect(activity[0]).toMatchObject({
          previousValue: { statusId: removed.id },
          nextValue: { statusId: destination.id },
        });
        const ownerEvents = await events(f.cookie, issue);
        expect(ownerEvents).toHaveLength(1);
        expect(ownerEvents[0]).toMatchObject({
          eventId: activity[0].id, actor: actorName, causes: ["status"],
        });
        expect(await events(f.bobCookie, issue)).toEqual([]);
        expect(await events(f.caraCookie, issue)).toEqual([]);
      }

      await receipt(await f.any(f.bobCookie, path, "DELETE", {
        destinationStatusId: destination.id,
      }), 404);
      const replayed = await Promise.all(issues.map(detail));
      expect(replayed.map(issue => ({ version: issue.version, activity: issue.activity })))
        .toEqual(after.map(issue => ({ version: issue.version, activity: issue.activity })));
      for (const issue of issues) {
        expect(await events(f.cookie, issue)).toHaveLength(1);
        expect(await events(f.bobCookie, issue)).toEqual([]);
        expect(await events(f.caraCookie, issue)).toEqual([]);
      }
    }
    expect(await count("notification_deliveries")).toBe(0);
    expect(await count("notification_candidates")).toBe(0);
    await exerciseSubjectSubscriptions(f);
  },
);
