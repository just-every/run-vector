import assert from "node:assert/strict";

export async function verifyDependencyRuntime({
  request,
  record,
  teamGraph,
  ids,
  evidence,
}) {
  let dependencyFilePath, dependencyFileBytes;
  evidence.dependencies = { phases: [] };
  async function create(title, teamId, statusId, assigneeOperatorId) {
    const response = await request(title, "/api/issues", {
      method: "POST",
      body: {
        title,
        teamId,
        statusId,
        assigneeOperatorId,
        description: "Preserve native **relationship** context",
        projectId: ids.project,
        estimate: 3,
        labelIds: [ids.reliabilityLabel],
        expectedOutcome: "Recorded dependencies drive Waiting",
        customerImpact: "Isolated synthetic relationship proof",
      },
    });
    assert.equal(response.status, 201);
    return response.json();
  }
  let a = await create(
    "Dependency customer repair",
    ids.flow,
    ids.unstarted,
    ids.sarah,
  );
  let b = await create(
    "Cross-team prerequisite",
    ids.platform,
    ids.platformStarted,
    ids.maya,
  );
  let c = await create("Root prerequisite", ids.flow, ids.unstarted, null);
  const attachmentPath = "/api/issues/" + a.identifier;
  const comment = await request(
    "native dependency retained comment",
    attachmentPath + "/comments",
    {
      method: "POST",
      body: { body: "Keep this **relationship** discussion." },
    },
  );
  assert.equal(comment.status, 201);
  const link = await request(
    "native dependency retained comment link",
    attachmentPath + "/links",
    {
      method: "POST",
      body: {
        name: "Dependency reference",
        url: "https://example.test/dependency-reference",
        commentId: comment.json().id,
      },
    },
  );
  assert.equal(link.status, 201);
  dependencyFileBytes = Buffer.from(
    "Private synthetic dependency evidence\nRetain across graph changes: ✓\n",
  );
  const upload = await request(
    "native dependency retained private file",
    attachmentPath + "/files",
    {
      method: "POST",
      rawBody: dependencyFileBytes,
      extraHeaders: {
        "Content-Type": "text/plain",
        "X-File-Name": "dependency-proof.txt",
      },
    },
  );
  assert.equal(upload.status, 201);
  dependencyFilePath = attachmentPath + "/files/" + upload.json().id;
  const file = await request(
    "native dependency private file before mutation",
    dependencyFilePath,
  );
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(file.bytes), dependencyFileBytes);
  const fresh = await request(
    "native dependency complete original read",
    attachmentPath,
  );
  assert.equal(fresh.status, 200);
  a = fresh.json();
  const issues = () => [a, b, c];
  const graphs = () => issues().map(teamGraph);
  async function read(saved) {
    const response = await request(
      "native relationship read " + saved.identifier,
      "/api/issues/" + saved.identifier,
    );
    assert.equal(response.status, 200);
    return response.json();
  }
  function body(issue, related, direction) {
    return {
      expectedVersion: issue.version,
      relatedIdentifier: related.identifier,
      relatedVersion: related.version,
      direction,
    };
  }
  async function change(
    issue,
    related,
    direction,
    method = "POST",
    fields = {},
  ) {
    return request(
      "native " +
        method +
        " dependency " +
        issue.identifier +
        " " +
        direction +
        " " +
        related.identifier,
      "/api/issues/" + issue.identifier + "/dependencies",
      {
        method,
        body: { ...body(issue, related, direction), ...fields },
      },
    );
  }
  async function waiting(expected) {
    const response = await request(
      "native Waiting after dependency mutation",
      "/api/my-work",
    );
    assert.equal(response.status, 200);
    const sections = response.json().sections;
    assert.equal(
      sections.waiting.some((row) => row.identifier === a.identifier),
      expected,
    );
    const row = Object.values(sections)
      .flat()
      .find((row) => row.identifier === a.identifier);
    assert.ok(row);
    assert.equal(
      row.status.id,
      ids.unstarted,
      "Blocking must not change workflow status",
    );
    assert.equal(
      row.primaryReason,
      expected ? "unresolved-dependency" : "assigned-to-you",
    );
    return row;
  }
  function retained(before, after) {
    const { version: _v1, updated_at: _t1, ...oldIssue } = before.issue;
    const { version: _v2, updated_at: _t2, ...newIssue } = after.issue;
    assert.deepEqual(
      newIssue,
      oldIssue,
      "Relationship must retain every unrelated issue property",
    );
    for (const key of [
      "decisions",
      "evidence",
      "labels",
      "comments",
      "links",
      "files",
      "cycles",
      "allocations",
    ])
      assert.deepEqual(
        after[key],
        before[key],
        "Relationship preserves " + key,
      );
    for (const event of before.activity)
      assert.deepEqual(
        after.activity.find((row) => row.id === event.id),
        event,
        "Old actor history remains immutable",
      );
  }
  await waiting(false);
  const initial = graphs();
  const first = await change(a, b, "blocked-by");
  assert.equal(first.status, 200);
  a = first.json().issue;
  b = first.json().relatedIssue;
  assert.equal(a.version, 2);
  assert.equal(b.version, 2);
  assert.equal(
    a.dependencies.find((row) => row.identifier === b.identifier).direction,
    "blocked-by",
  );
  assert.equal(
    b.dependencies.find((row) => row.identifier === a.identifier).direction,
    "blocks",
  );
  for (const issue of [a, b]) {
    const event = issue.activity.at(-1);
    assert.equal(event.kind, "issue.dependency_added");
    assert.equal(event.actor, "Sarah Chen");
    assert.equal(event.previousValue, null);
    assert.ok(event.nextValue.relatedIdentifier);
  }
  const firstGraphs = graphs();
  retained(initial[0], firstGraphs[0]);
  retained(initial[1], firstGraphs[1]);
  assert.deepEqual(firstGraphs[2], initial[2]);
  evidence.dependencies.phases.push({
    name: "native cross-team add",
    issues: issues(),
    graphs: firstGraphs,
    waiting: await waiting(true),
  });
  const chain = await change(b, c, "blocked-by");
  assert.equal(chain.status, 200);
  b = chain.json().issue;
  c = chain.json().relatedIssue;
  a = await read(a);
  const guardGraph = graphs();
  const failures = [
    [a, b, "blocked-by", "POST", {}, "dependency_exists"],
    [a, b, "blocks", "POST", {}, "dependency_exists"],
    [a, c, "blocks", "POST", {}, "dependency_cycle"],
    [a, a, "blocks", "POST", {}, "self_dependency"],
    [a, b, "blocked-by", "POST", { expectedVersion: 1 }, "stale_version"],
    [a, b, "blocked-by", "DELETE", { relatedVersion: 1 }, "stale_version"],
    [a, b, "blocks", "DELETE", {}, "dependency_not_found"],
  ];
  for (const [issue, related, direction, method, fields, error] of failures) {
    const response = await change(issue, related, direction, method, fields);
    assert.equal(response.status, 409);
    assert.equal(response.json().error, error);
    assert.deepEqual(
      graphs(),
      guardGraph,
      "Rejected dependency leaves the entire graph unchanged",
    );
  }
  const foreign = await change(a, b, "blocked-by", "DELETE", {
    relatedIdentifier: "ZZZ-999",
  });
  assert.equal(foreign.status, 404);
  assert.ok(!foreign.text.includes(b.title));
  const anonymous = await request(
    "anonymous relationship mutation",
    "/api/issues/" + a.identifier + "/dependencies",
    {
      method: "POST",
      body: body(a, b, "blocked-by"),
      authenticated: false,
    },
  );
  assert.equal(anonymous.status, 401);
  assert.deepEqual(graphs(), guardGraph);
  const removed = await change(a, b, "blocked-by", "DELETE");
  assert.equal(removed.status, 200);
  a = removed.json().issue;
  b = removed.json().relatedIssue;
  assert.equal(a.version, 3);
  assert.equal(b.version, 4);
  assert.ok(!a.dependencies.some((row) => row.identifier === b.identifier));
  for (const issue of [a, b]) {
    assert.equal(issue.activity.at(-1).kind, "issue.dependency_removed");
    assert.equal(issue.activity.at(-1).actor, "Sarah Chen");
    assert.equal(issue.activity.at(-1).nextValue, null);
  }
  await waiting(false);
  const restored = await change(a, b, "blocked-by");
  assert.equal(restored.status, 200);
  a = restored.json().issue;
  b = restored.json().relatedIssue;
  await waiting(true);
  record(
    "REL-001/ISSUE-006/007",
    "Native cross-team dependency add/remove writes one actor history/version on both endpoints; self, duplicate/reversed, directed cycle, stale source/related, missing-direction and anonymous/unavailable requests leave complete retained graphs unchanged.",
  );
  async function status(statusId) {
    const response = await request(
      "native blocker category change",
      "/api/issues/" + b.identifier,
      {
        method: "PATCH",
        body: { expectedVersion: b.version, statusId },
      },
    );
    assert.equal(response.status, 200);
    b = response.json();
    a = await read(a);
  }
  await status("01J00000000000000000000034");
  await waiting(false);
  await status(ids.platformStarted);
  await waiting(true);
  await status("01J00000000000000000000035");
  await waiting(false);
  await status(ids.platformStarted);
  await waiting(true);
  record(
    "REL-002/WORK-001",
    "Native completion/cancellation resolves the dependent Waiting state, reopening restores it, and no dependency operation silently changes the dependent workflow status. Duplicate exclusion remains covered by native D1 Worker projection fixtures, not a claimed Duplicate authoring route.",
  );
  const finalDependencyIssues = [a, b, c],
    finalDependencyGraphs = graphs();
  evidence.dependencies.finalBeforeRestart = {
    issues: finalDependencyIssues,
    graphs: finalDependencyGraphs,
    waiting: await waiting(true),
  };
  return {
    issues: finalDependencyIssues,
    graphs: finalDependencyGraphs,
    filePath: dependencyFilePath,
    fileBytes: dependencyFileBytes,
  };
}
