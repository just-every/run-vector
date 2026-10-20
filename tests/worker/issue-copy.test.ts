import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { setupIntegrations } from "./integration-fixture";
import { receipt } from "./subissues-fixture";
import { bindings, origin, request } from "./base-auth-fixture";
import { beforeCommit } from "./removal-interleaving";
import type { IssueDetailData } from "../../src/core/features/issues/ui/data";
import type { SubissuesData } from "../../src/core/features/subissues/schema";
import type { copyIssue } from "../../src/core/features/issue-copy/service";
type CopyReceipt = Awaited<ReturnType<typeof copyIssue>>;

it("[PROJ-011 ISSUE-023] native and scoped API copies preserve fields and ordered descendants, exclude discussion and map cross-team values with a loss report", async () => {
  const f = await setupIntegrations(),
    team = f.initial.teams[0];
  await f.mutate("/settings/labels", "POST", {
    name: "Copy label A",
    color: "#aabbcc",
  });
  await f.mutate("/settings/labels", "POST", {
    name: "Copy label B",
    color: "#112233",
  });
  await f.mutate("/settings/teams", "POST", {
    name: "Destination",
    identifierPrefix: "DEST",
  });
  const settings = await f.state(),
    labelIds = settings.labels.slice(-2).map((label) => label.id);
  const destination = settings.teams.find(
    (candidate) => candidate.name === "Destination",
  )!;
  await f.mutate("/settings/projects", "POST", {name:"Copy project",leadOperatorId:f.owner});
  const project = (await f.state()).projects.find(project => project.name === "Copy project")!;
  const milestoneResponse=await f.call('/settings/projects/'+project.id+'/milestones','POST',{name:'Copy milestone'});
  expect(milestoneResponse.status).toBe(200);
  const milestone=(await milestoneResponse.json() as any).milestones[0];
  await f.mutate("/settings/cycles", "POST", {
    teamId: team.id,
    name: "Copy cycle",
    startsLocal: "2035-01-01T00:00",
    endsLocal: "2035-01-14T00:00",
  });
  const cycle = (await f.state()).cycles.find(
    (candidate) => candidate.name === "Copy cycle",
  )!;
  const issue = await f.create({
    title: "Copy a complete issue",
    description: "Keep **this** description",
    priority: "high",
    estimate: 8,
    labelIds,
    projectId: project.id,
    milestoneId: milestone.id,
    cycleId: cycle.id,
    customFields: { department: "Platform", cost: 42 },
    statusId: team.statuses.find((status) => status.category === "started")!.id,
    assigneeOperatorId: f.owner,
  });
  const path = `/issues/${issue.identifier}`;
  let tree = await receipt<SubissuesData>(
    await f.call(path + "/subissues", "POST", {
      expectedVersion: issue.version,
      title: "First child",
    }),
    201,
  );
  tree = await receipt<SubissuesData>(
    await f.call(path + "/subissues", "POST", {
      expectedVersion: tree.version,
      title: "Second child",
    }),
    201,
  );
  const nested = await receipt<SubissuesData>(
    await f.call(`/issues/${tree.children[0].identifier}/subissues`, "POST", {
      expectedVersion: tree.children[0].version,
      title: "Grandchild",
    }),
    201,
  );
  const comment = await receipt<{ id: string }>(
    await f.call(path + "/comments", "POST", {
      body: "Do not copy this discussion",
    }),
    201,
  );
  await receipt(
    await f.call(path + "/links", "POST", {
      name: "Specification",
      url: "https://example.test/spec",
    }),
    201,
  );
  await receipt(
    await f.call(path + "/links", "POST", {
      name: "Comment context",
      url: "https://example.test/comment",
      commentId: comment.id,
    }),
    201,
  );
  const upload = await f.app.request(
    origin + "/api" + path + "/files",
    {
      method: "POST",
      headers: {
        host: new URL(origin).host,
        cookie: f.cookie,
        Origin: origin,
        "Content-Type": "text/plain",
        "x-file-name": "Original.txt",
      },
      body: "Original file bytes",
    },
    bindings,
  );
  await receipt(upload, 201);
  const original = await receipt<IssueDetailData>(await f.call(path));
  const copied = await receipt<CopyReceipt>(
    await f.call(path + "/copy", "POST", {
      expectedVersion: original.version,
      includeSubissues: true,
      includeLinks: true,
    }),
    201,
  );
  expect(copied.copies).toHaveLength(4);
  expect(new Set(copied.copies.map((copy) => copy.identifier)).size).toBe(4);
  expect(copied.issue.identifier).not.toBe(issue.identifier);
  for (const field of [
    "title",
    "description",
    "priority",
    "estimate",
    "customFields",
    "project",
    "milestoneId",
    "milestone",
    "cycle",
    "labels",
  ] as const)
    expect(copied.issue[field]).toEqual(original[field]);
  expect(copied.issue.status.category).toBe("backlog");
  expect(copied.issue.assignee).toBeNull();
  expect(copied.droppedValues).toEqual([]);
  const children = await receipt<SubissuesData>(
    await f.call(`/issues/${copied.issue.identifier}/subissues`),
  );
  expect(children.children.map((child) => child.title)).toEqual(
    tree.children.map((child) => child.title),
  );
  const grandchild = await receipt<SubissuesData>(
    await f.call(`/issues/${children.children[0].identifier}/subissues`),
  );
  expect(grandchild.children[0].title).toBe(nested.children[0].title);
  const links = await receipt<{
    links: { name: string; commentId: string | null }[];
  }>(await f.call(`/issues/${copied.issue.identifier}/links`));
  expect(links.links.map((link) => [link.name, link.commentId])).toEqual([
    ["Specification", null],
  ]);
  for (const pair of copied.copies) {
    const fresh = await receipt<IssueDetailData>(
      await f.call(`/issues/${pair.identifier}`),
    );
    const from = await receipt<IssueDetailData>(
      await f.call(`/issues/${pair.fromIdentifier}`),
    );
    expect(fresh.activity.map((activity) => activity.kind)).toEqual([
      "issue.copied_from",
    ]);
    expect(fresh.activity[0].nextValue).toEqual({
      identifier: pair.fromIdentifier,
    });
    expect(
      from.activity.some(
        (activity) =>
          activity.kind === "issue.copied_to" &&
          (activity.nextValue as { identifier: string }).identifier ===
            pair.identifier,
      ),
    ).toBe(true);
    const discussion = await receipt<{ comments: unknown[]; files: unknown[] }>(
      await f.call(`/issues/${pair.identifier}/discussion`),
    );
    expect(discussion.comments).toEqual([]);
    expect(discussion.files).toEqual([]);
    expect(
      await env.DB.prepare(
        "SELECT count(*) n FROM issue_followers WHERE issue_id=?",
      )
        .bind(fresh.id)
        .first<number>("n"),
    ).toBe(0);
  }
  const read = await f.issueToken(["issues:read"]),
    write = await f.issueToken(["issues:write"]);
  expect(
    (
      await f.api(read.token, path + "/copy", "POST", {
        expectedVersion: original.version,
      })
    ).status,
  ).toBe(401);
  const apiCopy = await receipt<CopyReceipt>(
    await f.api(write.token, path + "/copy", "POST", {
      expectedVersion: original.version,
    }),
    201,
  );
  expect(apiCopy.copies).toHaveLength(1);
  expect(apiCopy.issue.children).toEqual([]);
  expect(
    (
      await receipt<{ links: unknown[] }>(
        await f.call(`/issues/${apiCopy.issue.identifier}/links`),
      )
    ).links,
  ).toEqual([]);
  expect(apiCopy.issue.labels).toEqual(original.labels);
  expect(apiCopy.issue.customFields).toEqual(original.customFields);
  const childSource = await receipt<IssueDetailData>(await f.call(`/issues/${tree.children[0].identifier}`));
  const childCopy = await receipt<CopyReceipt>(await f.api(write.token,`/issues/${childSource.identifier}/copy`,"POST",{expectedVersion:childSource.version}),201);
  expect(childCopy.issue.parent).toBeNull();
  expect(childCopy.issue.children).toEqual([]);
  expect(childCopy.copies).toHaveLength(1);

  const cross = await receipt<CopyReceipt>(
    await f.api(write.token, path + "/copy", "POST", {
      expectedVersion: original.version,
      teamId: destination.id,
    }),
    201,
  );
  expect(cross.issue.team.id).toBe(destination.id);
  expect(cross.issue.identifier).not.toBe(apiCopy.issue.identifier);
  expect(cross.issue.cycle).toBeNull();
  expect(cross.issue.labels).toEqual(original.labels);
  expect(cross.issue.customFields).toEqual(original.customFields);
  expect(cross.issue.status.id).toBe(
    destination.statuses.find((status) => status.category === "backlog")!.id,
  );
  expect(cross.mappings[0].status).toEqual({
    from: original.status.id,
    to: cross.issue.status.id,
  });
  expect(cross.droppedValues).toEqual([
    {
      identifier: original.identifier,
      field: "cycleId",
      value: cycle.id,
      reason: expect.any(String),
    },
  ]);
  expect(
    (
      await f.call(path + "/copy", "POST", {
        expectedVersion: original.version + 100,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("/api" + path + "/copy", "POST", {
        expectedVersion: original.version,
      })
    ).status,
  ).toBe(401);
  await f.mutate("/settings/teams/" + destination.id, "PATCH", {
    archived: true,
  });
  expect(
    (
      await f.call(path + "/copy", "POST", {
        expectedVersion: original.version,
        teamId: destination.id,
      })
    ).status,
  ).toBe(400);
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
}, 180000);

it("[ISSUE-023] a concurrent link change rejects the entire prepared copy tree and both histories atomically", async () => {
  const f = await setupIntegrations(),
    issue = await f.create({ title: "Atomic copy" });
  const tree = await receipt<SubissuesData>(
    await f.call(`/issues/${issue.identifier}/subissues`, "POST", {
      expectedVersion: issue.version,
      title: "Atomic child",
    }),
    201,
  );
  const countBefore = await env.DB.prepare(
    "SELECT count(*) n FROM issues",
  ).first<number>("n");
  const historyBefore = await env.DB.prepare("SELECT count(*) n FROM issue_activity WHERE kind IN ('issue.copied_from','issue.copied_to')").first<number>("n");
  const db = beforeCommit(
    (query) => query.includes("INSERT INTO issues(id,identifier,origin_prefix"),
    async () => {
      await receipt(
        await f.call(`/issues/${issue.identifier}/links`, "POST", {
          name: "Concurrent link",
          url: "https://example.test/race",
        }),
        201,
      );
    },
  );
  const response = await request(
    `/api/issues/${issue.identifier}/copy`,
    "POST",
    {
      expectedVersion: tree.version,
      includeSubissues: true,
      includeLinks: true,
    },
    f.cookie,
    { DB: db },
  );
  await receipt(response, 409);
  expect(
    await env.DB.prepare("SELECT count(*) n FROM issues").first<number>("n"),
  ).toBe(countBefore);
  expect(
    await env.DB.prepare(
      "SELECT count(*) n FROM issue_activity WHERE kind IN ('issue.copied_from','issue.copied_to')",
    ).first<number>("n"),
  ).toBe(historyBefore);
});
