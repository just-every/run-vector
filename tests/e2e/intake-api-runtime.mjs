import { verificationDirectory } from '../../scripts/verification-paths.mjs';
import assert from "node:assert/strict";
import { verifyDependencyRuntime } from "./dependency-api-checks.mjs";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

// HTTP/Worker only. This verifier never imports or launches a browser.
const root = process.cwd();
const scope = process.env.VECTOR_API_SCOPE ?? "intake";
assert.ok(
  ["intake", "context", "team", "cycles", "dependencies"].includes(scope),
  "VECTOR_API_SCOPE must be intake, context, team, cycles or dependencies",
);
const dependencySlice = scope === "dependencies";
const cycleSlice = scope === "cycles" || dependencySlice;
const teamSlice = scope === "team" || cycleSlice;
const contextSlice = scope === "context" || teamSlice;
const evidenceName = dependencySlice
  ? "dependency-api-runtime"
  : cycleSlice
    ? "cycle-context-api-runtime"
    : teamSlice
      ? "team-move-api-runtime"
      : contextSlice
        ? "context-api-runtime"
        : "intake-api-runtime";
const portInput =
  process.env.VECTOR_API_PORT ??
  (dependencySlice
    ? "15950"
    : cycleSlice
      ? "15946"
      : teamSlice
        ? "15942"
        : "15934");
assert.match(
  portInput,
  /^[0-9]{5}$/,
  "VECTOR_API_PORT must be a decimal loopback port",
);
const port = Number(portInput);
assert.ok(
  port >= 15920 && port <= 15958,
  "HTTP and inspector ports must remain in allocated range 15920–15959",
);
const inspectorPort = port + 1;
const base = "http://127.0.0.1:" + port;
const runId =
  new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.pid;
const state = `.wrangler/vector-intake-api/runs/${runId}`;
const evidenceDirectory = resolve(verificationDirectory);
const logDirectory = resolve(verificationDirectory, "intake-api-" + runId);
const ids = {
  sarah: "01J00000000000000000000002",
  flow: "01J00000000000000000000010",
  platform: "01J00000000000000000000011",
  unstarted: "01J00000000000000000000022",
  started: "01J00000000000000000000023",
  platformIntake: "01J00000000000000000000030",
  platformUnstarted: "01J00000000000000000000032",
  platformStarted: "01J00000000000000000000033",
  maya: "01J00000000000000000000003",
  project: "01J00000000000000000000040",
  cycle: "01J00000000000000000000050",
  customerLabel: "01J00000000000000000000060",
  reliabilityLabel: "01J00000000000000000000061",
  dependency: "01J00000000000000000000100",
};
const evidence = {
  passed: false,
  startedAt: new Date().toISOString(),
  base,
  scope,
  port,
  inspectorPort,
  state,
  browser: "No browser imported or launched",
  responses: [],
  checks: [],
  ownedPids: [],
  limits: [
    "Local synthetic emitted HTTP/D1/R2 behavior only; no UI, remote provider, deployment, full baseline or latency/capacity acceptance.",
    ...(teamSlice
      ? [
          dependencySlice
            ? "The original team-move dependency is an explicit isolated D1 retained-graph fixture; separate dependency checks use the native add/remove API. Native auth, issue/intake creation, comment/link/file mutations and team moves use actual HTTP routes."
            : "The dependency relation is an explicit isolated D1 fixture; no dependency mutation API is claimed. Native auth, issue/intake creation, comment/link/file mutations and team moves use actual HTTP routes.",
        ]
      : []),
  ],
};
let contextIssue, contextReceipt;
let finalCycleContext;
let finalDependencyIssues,
  finalDependencyGraphs,
  dependencyFilePath,
  dependencyFileBytes;
let movedIssue,
  movedIntake,
  movedGraph,
  movedIntakeReceipt,
  movedDiscussion,
  movedFilePath,
  movedFileBytes;
let worker,
  workerLog = "",
  cookie;
await mkdir(evidenceDirectory, { recursive: true });

function command(args) {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, WRANGLER_LOG_PATH: logDirectory },
  });
}
function sql(query) {
  return sqlResultSets([query])[0];
}
function sqlResultSets(queries) {
  const results = JSON.parse(
    command([
      "d1",
      "execute",
      "vector-local",
      "--local",
      "--config",
      "wrangler.jsonc",
      "--persist-to",
      state,
      "--command",
      queries.join(";\n"),
      "--json",
    ]),
  );
  assert.equal(
    results.length,
    queries.length,
    "Wrangler must return one result set per statement",
  );
  return results.map((result) => {
    assert.equal(result.success, true, "Local D1 statement must succeed");
    return result.results;
  });
}
function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}
async function hashes(paths) {
  const entries = [];
  for (const path of paths)
    entries.push({
      path: relative(root, path),
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    });
  return {
    entries,
    manifestSha256: createHash("sha256")
      .update(JSON.stringify(entries))
      .digest("hex"),
  };
}
async function emission() {
  return hashes(await files(resolve("dist")));
}
function start() {
  worker = spawn(
    process.execPath,
    [
      resolve("node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--local",
      "--test-scheduled",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      String(inspectorPort),
      "--persist-to",
      state,
      "--var",
      "APP_ORIGIN:" + base,
    ],
    {
      cwd: root,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_LOG_PATH: logDirectory },
    },
  );
  evidence.ownedPids.push(worker.pid);
  worker.stdout.on("data", (bytes) => (workerLog += bytes));
  worker.stderr.on("data", (bytes) => (workerLog += bytes));
}
async function ready() {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (worker.exitCode !== null) throw new Error(workerLog);
    try {
      if (
        (await fetch(base + "/health", { headers: { Connection: "close" } })).ok
      )
        return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Owned emitted Worker did not become ready\n" + workerLog);
}
async function stop() {
  if (!worker) return;
  const owned = worker;
  try {
    process.kill(-owned.pid, "SIGTERM");
  } catch {}
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(base + "/health", { headers: { Connection: "close" } });
    } catch {
      worker = undefined;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Owned emitted Worker did not stop");
}
async function request(
  label,
  path,
  {
    method = "GET",
    body,
    rawBody,
    extraHeaders = {},
    authenticated = true,
  } = {},
) {
  assert.ok(
    body === undefined || rawBody === undefined,
    "Use JSON body or rawBody, never both",
  );
  const response = await fetch(base + path, {
    redirect: "manual",
    method,
    headers: {
      Connection: "close",
      Origin: base,
      ...(authenticated && cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...extraHeaders,
    },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const raw = {
    label,
    path,
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: text,
    bodySha256: createHash("sha256").update(bytes).digest("hex"),
  };
  if (raw.headers["set-cookie"])
    raw.headers["set-cookie"] = "[opaque native cookie held only in memory]";
  evidence.responses.push(raw);
  return {
    status: response.status,
    text,
    bytes,
    headers: raw.headers,
    json: () => JSON.parse(text),
  };
}
function record(clause, detail) {
  evidence.checks.push({ clause, passed: true, detail });
  console.info("[Vector intake API] Passed " + clause);
}
async function current(label) {
  const response = await request(label, "/api/current");
  assert.equal(response.status, 200);
  return response.json();
}
function pending(stream, identifier) {
  return stream.sections["needs-decision"].some(
    (issue) => issue.identifier === identifier,
  );
}
function receipt(issue) {
  const [issues, activity, decisions, evidence] = sqlResultSets(
    receiptSelects(issue),
  );
  return { issue: issues[0], activity, decisions, evidence };
}
function receiptSelects(
  issue,
  fields = "id,identifier,version,status_id,deferred_until",
) {
  return [
    `SELECT ${fields} FROM issues WHERE id='${issue.id}'`,
    `SELECT id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at FROM issue_activity WHERE issue_id='${issue.id}' ORDER BY created_at,id`,
    `SELECT id,actor_operator_id,kind,reason,return_at,created_at,updated_at FROM intake_decisions WHERE issue_id='${issue.id}' ORDER BY created_at,id`,
    `SELECT * FROM evidence_revisions WHERE issue_id='${issue.id}' ORDER BY observed_at,received_at,id`,
  ];
}

function teamGraph(issue) {
  const [
    issues,
    activity,
    decisions,
    evidence,
    labels,
    dependencies,
    comments,
    links,
    files,
    cycles,
    allocations,
  ] = sqlResultSets([
    ...receiptSelects(issue, "*"),
    `SELECT * FROM issue_labels WHERE issue_id='${issue.id}' ORDER BY label_id`,
    `SELECT * FROM issue_dependencies WHERE blocked_issue_id='${issue.id}' OR blocking_issue_id='${issue.id}' ORDER BY blocked_issue_id,blocking_issue_id`,
    `SELECT * FROM issue_comments WHERE issue_id='${issue.id}' ORDER BY id`,
    `SELECT * FROM issue_links WHERE issue_id='${issue.id}' ORDER BY id`,
    `SELECT * FROM issue_files WHERE issue_id='${issue.id}' ORDER BY id`,
    "SELECT * FROM cycles ORDER BY id",
    "SELECT * FROM team_issue_sequences ORDER BY team_id",
  ]);
  return {
    issue: issues[0],
    activity,
    decisions,
    evidence,
    labels,
    dependencies,
    comments,
    links,
    files,
    cycles,
    allocations,
  };
}

async function verifyTeamMoves() {
  const input = {
    title: "Emitted rich-context team move",
    teamId: ids.flow,
    statusId: ids.unstarted,
    description: "**Keep this description** across teams.",
    assigneeOperatorId: ids.maya,
    priority: "high",
    projectId: ids.project,
    cycleId: ids.cycle,
    estimate: 13,
    dueDate: "2028-02-29",
    labelIds: [ids.customerLabel, ids.reliabilityLabel],
    expectedOutcome: "Keep the original work",
    customerImpact: "Synthetic native move review",
    customFields: {
      nested: { first: 1, second: false },
      array: [null, "retained", 3],
    },
  };
  const creation = await request(
    "native rich issue for team move",
    "/api/issues",
    { method: "POST", body: input },
  );
  assert.equal(creation.status, 201);
  movedIssue = creation.json();
  assert.equal(movedIssue.version, 1);
  const path = "/api/issues/" + movedIssue.identifier;
  const comment = await request(
    "native preserved move comment",
    path + "/comments",
    {
      method: "POST",
      body: { body: "Preserve this **native comment**." },
    },
  );
  assert.equal(comment.status, 201);
  const link = await request("native preserved comment link", path + "/links", {
    method: "POST",
    body: {
      name: "Move reference",
      url: "https://example.test/move-reference",
      commentId: comment.json().id,
    },
  });
  assert.equal(link.status, 201);
  movedFileBytes = Buffer.from(
    "Original private move evidence\nUTF-8 retained: ✓\n",
  );
  const upload = await request(
    "native raw private file before move",
    path + "/files",
    {
      method: "POST",
      rawBody: movedFileBytes,
      extraHeaders: {
        "Content-Type": "text/plain",
        "X-File-Name": encodeURIComponent("move evidence.txt"),
        "X-File-Name-Encoding": "uri",
      },
    },
  );
  assert.equal(upload.status, 201);
  movedFilePath = path + "/files/" + upload.json().id;
  const originalBytes = await request(
    "private original file read before move",
    movedFilePath,
  );
  assert.equal(originalBytes.status, 200);
  assert.deepEqual(Buffer.from(originalBytes.bytes), movedFileBytes);
  assert.equal(
    (
      await request(
        "anonymous private file denial before move",
        movedFilePath,
        { authenticated: false },
      )
    ).status,
    401,
  );

  // This original retained-graph relation remains an explicit isolated D1
  // fixture; separate dependency authoring checks use native HTTP, not this setup.
  const createdAt = new Date().toISOString();
  sql(
    `INSERT INTO issue_dependencies(blocked_issue_id,blocking_issue_id,created_at) VALUES('${movedIssue.id}','${ids.dependency}','${createdAt}')`,
  );
  const original = await request(
    "fresh original move issue and dependency",
    path,
  );
  assert.equal(original.status, 200);
  const originalIssue = original.json(),
    before = teamGraph(originalIssue);
  assert.equal(originalIssue.dependencies.length, 1);
  assert.equal(originalIssue.dependencies[0].identifier, "FLW-842");
  assert.equal(before.issue.origin_prefix, "FLW");
  const denied = await request("anonymous team move denied", path + "/team", {
    method: "POST",
    authenticated: false,
    body: {
      expectedVersion: originalIssue.version,
      teamId: ids.platform,
      statusId: ids.platformUnstarted,
    },
  });
  assert.equal(denied.status, 401);
  assert.deepEqual(teamGraph(originalIssue), before);
  const moved = await request(
    "native Flow to Platform same-category move",
    path + "/team",
    {
      method: "POST",
      body: {
        expectedVersion: originalIssue.version,
        teamId: ids.platform,
        statusId: ids.platformUnstarted,
      },
    },
  );
  assert.equal(moved.status, 200);
  movedIssue = moved.json();
  assert.equal(movedIssue.identifier, originalIssue.identifier);
  assert.equal(movedIssue.version, originalIssue.version + 1);
  assert.equal(movedIssue.team.id, ids.platform);
  assert.equal(movedIssue.status.id, ids.platformUnstarted);
  assert.equal(movedIssue.status.category, "unstarted");
  assert.equal(movedIssue.cycle, null);
  for (const field of [
    "id",
    "title",
    "description",
    "priority",
    "assignee",
    "dueDate",
    "estimate",
    "expectedOutcome",
    "customerImpact",
    "customFields",
    "labels",
    "dependencies",
    "evidence",
    "decisions",
    "createdAt",
    "completedAt",
    "canceledAt",
    "deferredUntil",
  ])
    assert.deepEqual(movedIssue[field], originalIssue[field], field);
  assert.equal(movedIssue.project.id, originalIssue.project.id);
  assert.equal(movedIssue.project.name, originalIssue.project.name);
  const after = teamGraph(movedIssue);
  assert.deepEqual(
    {
      ...after.issue,
      team_id: before.issue.team_id,
      status_id: before.issue.status_id,
      cycle_id: before.issue.cycle_id,
      version: before.issue.version,
      updated_at: before.issue.updated_at,
    },
    before.issue,
  );
  for (const field of [
    "labels",
    "dependencies",
    "evidence",
    "decisions",
    "comments",
    "links",
    "files",
    "cycles",
    "allocations",
  ])
    assert.deepEqual(after[field], before[field], field);
  assert.equal(after.activity.length, before.activity.length + 1);
  for (const event of before.activity)
    assert.deepEqual(
      after.activity.find((row) => row.id === event.id),
      event,
    );
  const events = movedIssue.activity.filter(
    (event) => event.kind === "issue.team_moved",
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].actor, "Sarah Chen");
  assert.deepEqual(events[0].previousValue, {
    teamId: ids.flow,
    statusId: ids.unstarted,
    cycleId: ids.cycle,
  });
  assert.deepEqual(events[0].nextValue, {
    teamId: ids.platform,
    statusId: ids.platformUnstarted,
    cycleId: null,
  });
  const noop = await request(
    "same-team same-status guarded move no-op",
    path + "/team",
    {
      method: "POST",
      body: {
        expectedVersion: movedIssue.version,
        teamId: ids.platform,
        statusId: ids.platformUnstarted,
      },
    },
  );
  assert.equal(noop.status, 200);
  assert.deepEqual(noop.json(), movedIssue);
  assert.deepEqual(teamGraph(movedIssue), after);
  const stale = await request(
    "stale team move returns current",
    path + "/team",
    {
      method: "POST",
      body: {
        expectedVersion: originalIssue.version,
        teamId: ids.flow,
        statusId: ids.unstarted,
      },
    },
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.json().error, "stale_version");
  assert.deepEqual(stale.json().issue, movedIssue);
  assert.equal(stale.json().version, movedIssue.version);
  const wrongCategory = await request(
    "wrong-category team move rejected",
    path + "/team",
    {
      method: "POST",
      body: {
        expectedVersion: movedIssue.version,
        teamId: ids.flow,
        statusId: ids.started,
      },
    },
  );
  assert.equal(wrongCategory.status, 400);
  assert.equal(wrongCategory.json().error, "invalid_option");
  assert.deepEqual(teamGraph(movedIssue), after);
  const discussion = await request(
    "moved discussion graph read",
    path + "/discussion",
  );
  assert.equal(discussion.status, 200);
  movedDiscussion = discussion.json();
  assert.equal(movedDiscussion.comments[0].id, comment.json().id);
  assert.equal(
    movedDiscussion.comments[0].body,
    "Preserve this **native comment**.",
  );
  assert.equal(movedDiscussion.links[0].name, "Move reference");
  assert.equal(movedDiscussion.files[0].id, upload.json().id);
  assert.equal(movedDiscussion.files[0].state, "ready");
  const bytes = await request(
    "unchanged private file bytes after move",
    movedFilePath,
  );
  assert.equal(bytes.status, 200);
  assert.deepEqual(Buffer.from(bytes.bytes), movedFileBytes);
  assert.equal(
    (
      await request("anonymous private moved file denial", movedFilePath, {
        authenticated: false,
      })
    ).status,
    401,
  );
  evidence.teamMove = {
    ordinary: {
      before,
      after,
      discussion: movedDiscussion,
      file: {
        path: movedFilePath,
        bytes: movedFileBytes.length,
        sha256: createHash("sha256").update(movedFileBytes).digest("hex"),
      },
    },
    dependencyFixture: {
      kind: "Direct isolated D1 relation",
      blockedIssue: movedIssue.id,
      blockingIssue: ids.dependency,
    },
  };
  record(
    "ISSUE-012/002/006/007/CYCLE-002",
    "Actual native same-category team move preserves identifier/allocation/all metadata and graph/file bytes, clears only the cycle and appends one actor activity/version; no-op, stale409 and wrong-category400 leave storage unchanged.",
  );

  const intakeInput = {
    title: "Misrouted attributed operator Intake",
    teamId: ids.flow,
    description: "**Original intake evidence**",
    observedAt: "2026-10-02T13:00:00+10:00",
    summary: "Native report for the target team",
    link: "https://example.test/team-intake",
    measurements: { queueSeconds: 23, repeated: true },
    customerReports: [
      {
        customer: "Synthetic move customer",
        summary: "Keep the report",
        link: "https://example.test/team-customer",
      },
    ],
    expectedOutcome: "Target team reviews the original report",
    customerImpact: "Synthetic move only",
  };
  const intakeCreation = await request(
    "native attributed Intake before move",
    "/api/intake",
    { method: "POST", body: intakeInput },
  );
  assert.equal(intakeCreation.status, 201);
  movedIntake = intakeCreation.json();
  const originalIntake = movedIntake,
    intakePath = "/api/issues/" + movedIntake.identifier;
  assert.equal(originalIntake.evidence[0].actor, "Sarah Chen");
  assert.equal(originalIntake.evidence[0].originKind, "operator");
  assert.equal(
    receipt(originalIntake).evidence[0].actor_operator_id,
    ids.sarah,
  );
  const returnAt = new Date(Date.now() + 7200000).toISOString();
  const deferral = await request(
    "native future deferral before Intake team move",
    intakePath + "/defer",
    {
      method: "POST",
      body: {
        expectedVersion: 1,
        returnAt,
        reason: "Target team should retain this decision",
      },
    },
  );
  assert.equal(deferral.status, 200);
  assert.equal(deferral.json().version, 2);
  const beforeIntake = receipt(originalIntake);
  const intakeMove = await request(
    "native deferred Intake move without triage",
    intakePath + "/team",
    {
      method: "POST",
      body: {
        expectedVersion: 2,
        teamId: ids.platform,
        statusId: ids.platformIntake,
      },
    },
  );
  assert.equal(intakeMove.status, 200);
  movedIntake = intakeMove.json();
  assert.equal(movedIntake.identifier, originalIntake.identifier);
  assert.equal(movedIntake.version, 3);
  assert.equal(movedIntake.team.id, ids.platform);
  assert.equal(movedIntake.status.id, ids.platformIntake);
  assert.equal(movedIntake.status.category, "intake");
  assert.equal(movedIntake.deferredUntil, returnAt);
  assert.deepEqual(movedIntake.evidence, originalIntake.evidence);
  assert.deepEqual(movedIntake.decisions, deferral.json().decisions);
  const afterIntakeMove = receipt(movedIntake);
  assert.deepEqual(afterIntakeMove.evidence, beforeIntake.evidence);
  assert.deepEqual(afterIntakeMove.decisions, beforeIntake.decisions);
  assert.equal(
    afterIntakeMove.activity.length,
    beforeIntake.activity.length + 1,
  );
  for (const event of beforeIntake.activity)
    assert.deepEqual(
      afterIntakeMove.activity.find((row) => row.id === event.id),
      event,
    );
  assert.equal(
    afterIntakeMove.activity.filter(
      (event) => event.kind === "issue.team_moved",
    ).length,
    1,
  );
  assert.ok(
    !pending(
      await current("moved deferred Intake remains hidden"),
      movedIntake.identifier,
    ),
  );
  const returned = await request(
    "native early return after Intake move",
    intakePath + "/return",
    { method: "POST", body: { expectedVersion: 3 } },
  );
  assert.equal(returned.status, 200);
  assert.equal(returned.json().version, 4);
  assert.equal(returned.json().deferredUntil, null);
  assert.ok(
    pending(
      await current("returned target Intake appears in Current"),
      movedIntake.identifier,
    ),
  );
  const accepted = await request(
    "native moved Intake accepts target workflow",
    intakePath + "/accept",
    {
      method: "POST",
      body: {
        expectedVersion: 4,
        statusId: ids.platformStarted,
        assigneeOperatorId: ids.sarah,
        priority: "high",
        reason: "Begin target-team work",
      },
    },
  );
  assert.equal(accepted.status, 200);
  movedIntake = accepted.json();
  assert.equal(movedIntake.version, 5);
  assert.equal(movedIntake.team.id, ids.platform);
  assert.equal(movedIntake.status.id, ids.platformStarted);
  assert.deepEqual(movedIntake.evidence, originalIntake.evidence);
  assert.equal(movedIntake.decisions.length, 2);
  assert.deepEqual(movedIntake.decisions[0], deferral.json().decisions[0]);
  movedIntakeReceipt = receipt(movedIntake);
  assert.deepEqual(movedIntakeReceipt.evidence, beforeIntake.evidence);
  assert.deepEqual(movedIntakeReceipt.decisions[0], beforeIntake.decisions[0]);
  const work = await request(
    "accepted moved Intake target My Work",
    "/api/my-work",
  );
  assert.equal(work.status, 200);
  const assigned = Object.values(work.json().sections)
    .flat()
    .find((row) => row.identifier === movedIntake.identifier);
  assert.ok(assigned);
  assert.equal(assigned.team.id, ids.platform);
  assert.equal(assigned.status.id, ids.platformStarted);
  evidence.teamMove.intake = {
    before: beforeIntake,
    afterMove: afterIntakeMove,
    accepted: movedIntakeReceipt,
    returnAt,
  };
  record(
    "ISSUE-012/INTAKE-001/005/006",
    "Attributed native Intake can defer, move to target Intake without a decision or losing evidence/deferral history, return early and accept into the target Started workflow/version5.",
  );
}

async function verifyCycleContext() {
  const teamId = "01J00000000000000000007000",
    cycleId = "01J00000000000000000007010";
  const statusIds = {
    intake: "01J00000000000000000007021",
    backlog: "01J00000000000000000007022",
    unstarted: "01J00000000000000000007023",
    started: "01J00000000000000000007024",
    completed: "01J00000000000000000007025",
    canceled: "01J00000000000000000007026",
    duplicate: "01J00000000000000000007027",
  };
  const now = new Date(),
    timestamp = now.toISOString(),
    startsAt = new Date(now.getTime() - 172800000).toISOString(),
    endsAt = new Date(now.getTime() + 259200000).toISOString();
  const setup = [
    `INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) VALUES('${teamId}','01J00000000000000000000001','Cycle proof','CTX','${timestamp}','${timestamp}')`,
    ...Object.entries(statusIds).map(
      ([category, id], position) =>
        `INSERT INTO workflow_statuses(id,team_id,name,category,position,created_at,updated_at) VALUES('${id}','${teamId}','${category}','${category}',${position},'${timestamp}','${timestamp}')`,
    ),
    `INSERT INTO cycles(id,team_id,name,starts_at,ends_at,capacity,created_at,updated_at) VALUES('${cycleId}','${teamId}','Whole team scope','${startsAt}','${endsAt}',7,'${timestamp}','${timestamp}')`,
  ];
  sqlResultSets(setup);
  evidence.limits.push(
    "Cycle team/workflow/timebox and Duplicate category are explicit isolated D1 projection fixtures; these fixtures provide no cycle administration, relationship authoring or closure acceptance. Issues/estimates/status edits and commitments use native HTTP; any native relationship checks are recorded separately.",
  );
  evidence.cycleContext = {
    fixture: {
      teamId,
      cycleId,
      startsAt,
      endsAt,
      kind: "Isolated synthetic D1 team/workflow/cycle; native issue writes; explicit Duplicate projection row",
    },
    phases: [],
  };
  async function create(
    title,
    estimate,
    assigneeOperatorId = ids.sarah,
    statusId = statusIds.unstarted,
  ) {
    const response = await request(title, "/api/issues", {
      method: "POST",
      body: { title, teamId, statusId, estimate, assigneeOperatorId, cycleId },
    });
    assert.equal(response.status, 201);
    return response.json();
  }
  async function edit(issue, fields) {
    const response = await request(
      "native cycle context edit " + issue.identifier,
      "/api/issues/" + issue.identifier,
      { method: "PATCH", body: { expectedVersion: issue.version, ...fields } },
    );
    assert.equal(response.status, 200);
    return response.json();
  }
  async function context(phase, expected) {
    const response = await request("native My Work " + phase, "/api/my-work");
    assert.equal(response.status, 200);
    const row = response.json().cycles.find((row) => row.id === cycleId);
    assert.ok(row);
    assert.equal(row.timezone, "Australia/Brisbane");
    assert.equal(row.startsAt, startsAt);
    assert.equal(row.endsAt, endsAt);
    for (const [key, value] of Object.entries(expected))
      assert.equal(row[key], value, phase + " " + key);
    evidence.cycleContext.phases.push({ phase, row });
    return row;
  }
  let done = await create("Completed scope belongs to the whole cycle", 5),
    other = await create(
      "Another assignee is included in whole scope",
      8,
      ids.maya,
      statusIds.started,
    ),
    remaining = await create("Signed-in operator remaining scope", 3),
    canceled = await create("Canceled unestimated scope is excluded", null),
    duplicate = await create(
      "Duplicate unestimated scope is excluded",
      null,
      ids.maya,
    );
  done = await edit(done, { statusId: statusIds.completed });
  canceled = await edit(canceled, { statusId: statusIds.canceled });
  sql(
    `UPDATE issues SET status_id='${statusIds.duplicate}' WHERE id='${duplicate.id}'`,
  );
  await context("whole estimated scope", {
    completed: 5,
    total: 16,
    unit: "points",
    percentage: 31.25,
    capacity: 7,
    capacityRisk: "at-risk",
    remainingPoints: 11,
    unestimatedRemaining: 0,
  });
  other = await edit(other, { estimate: null });
  await context("missing remaining estimate", {
    completed: 1,
    total: 3,
    unit: "issue-count",
    percentage: (1 / 3) * 100,
    capacityRisk: "unknown",
    remainingPoints: null,
    unestimatedRemaining: 1,
  });
  other = await edit(other, { estimate: 8 });
  done = await edit(done, { estimate: null });
  await context("missing completed estimate with known remaining capacity", {
    completed: 1,
    total: 3,
    unit: "issue-count",
    percentage: (1 / 3) * 100,
    capacityRisk: "at-risk",
    remainingPoints: 11,
    unestimatedRemaining: 0,
  });
  sql(`UPDATE cycles SET capacity=11 WHERE id='${cycleId}'`);
  await context("remaining equals capacity", {
    capacity: 11,
    capacityRisk: "within-capacity",
    remainingPoints: 11,
  });
  done = await edit(done, { cycleId: null });
  other = await edit(other, { cycleId: null });
  remaining = await edit(remaining, { cycleId: null });
  await context("only excluded scope remains", {
    completed: 0,
    total: 0,
    percentage: null,
    remainingPoints: 0,
    unestimatedRemaining: 0,
    capacityRisk: "within-capacity",
  });
  sql(`UPDATE cycles SET capacity=0 WHERE id='${cycleId}'`);
  remaining = await edit(remaining, { cycleId });
  await context("zero capacity with remaining work", {
    completed: 0,
    total: 3,
    unit: "points",
    percentage: 0,
    capacity: 0,
    capacityRisk: "at-risk",
    remainingPoints: 3,
  });
  sql(`UPDATE cycles SET capacity=NULL WHERE id='${cycleId}'`);
  await context("capacity absent", {
    capacity: null,
    capacityRisk: "unknown",
    remainingPoints: 3,
  });
  // Restore a useful final review through native writes, retaining every earlier event.
  other = await edit(other, { cycleId });
  done = await edit(done, {
    statusId: statusIds.unstarted,
    estimate: 5,
    cycleId,
  });
  done = await edit(done, { statusId: statusIds.completed });
  sql(`UPDATE cycles SET capacity=7 WHERE id='${cycleId}'`);
  finalCycleContext = await context("final native whole cycle", {
    completed: 5,
    total: 16,
    unit: "points",
    percentage: 31.25,
    capacity: 7,
    capacityRisk: "at-risk",
    remainingPoints: 11,
    unestimatedRemaining: 0,
  });
  const response = await request(
    "all active teams visible in My Work data",
    "/api/my-work",
  );
  assert.equal(response.status, 200);
  assert.ok(response.json().cycles.length >= 2);
  evidence.cycleContext.finalIssues = [
    done,
    other,
    remaining,
    canceled,
    duplicate,
  ].map((issue) => ({
    id: issue.id,
    identifier: issue.identifier,
    version: issue.version,
  }));
  record(
    "WORK-003/CYCLE-003",
    "Native committed issues expose whole-cycle point scope including another assignee, exclusion of Canceled/Duplicate, fallback counts, independently known/unknown capacity, equal/zero/absent capacity, no included work and workspace-timezone dates with all active team rows.",
  );
}

try {
  const config = JSON.parse(
    await readFile("dist/server/wrangler.json", "utf8"),
  );
  assert.equal(
    config.no_bundle,
    true,
    "The current emitted artifact must remain unbundled",
  );
  evidence.source = {
    commit: git(["rev-parse", "HEAD"]),
    status: git(["status", "--short"]),
    hashes: await hashes(
      [
        ...(await files(resolve("src"))),
        ...(await files(resolve("migrations/core"))),
        ...[
          "package.json",
          "pnpm-lock.yaml",
          "wrangler.jsonc",
          "vite.config.ts",
          "tests/e2e/intake-api-runtime.mjs",
          "tests/e2e/dependency-api-checks.mjs",
        ].map((path) => resolve(path)),
        ...(await files(resolve("sample-data"))),
      ].sort(),
    ),
  };
  evidence.emission = await emission();
  command([
    "d1",
    "migrations",
    "apply",
    "vector-local",
    "--local",
    "--config",
    "wrangler.jsonc",
    "--persist-to",
    state,
  ]);
  start();
  await ready();

  const signIn = await request("native magic-link request", "/auth/request", {
    method: "POST",
    authenticated: false,
    body: { email: "sarah@vector.test", returnTo: "/app/current" },
  });
  assert.equal(signIn.status, 202);
  assert.ok(!signIn.text.includes("token="));
  const link = sql(
    "SELECT sign_in_url FROM local_mail_outbox WHERE recipient='sarah@vector.test' ORDER BY created_at DESC,id DESC LIMIT 1",
  )[0].sign_in_url;
  assert.equal(new URL(link).origin, base);
  const callback = await fetch(link, {
    redirect: "manual",
    headers: { Connection: "close" },
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/app/current");
  assert.match(callback.headers.get("set-cookie"), /HttpOnly/);
  assert.match(callback.headers.get("set-cookie"), /SameSite=Lax/);
  cookie = callback.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await fetch(link, {
        redirect: "manual",
        headers: { Connection: "close" },
      })
    ).status,
    400,
  );
  evidence.nativeAuth = {
    requestStatus: 202,
    consumeStatus: 302,
    returnTo: "/app/current",
    singleUseReplayStatus: 400,
    cookie: "Native opaque HttpOnly SameSite=Lax; raw value not recorded",
  };
  record(
    "BASE-ACCESS-001",
    "Real allow-listed request/outbox/consume native sign-in; single-use callback and persisted opaque session.",
  );

  assert.equal(
    (
      await request("anonymous private read", "/api/current", {
        authenticated: false,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("anonymous intake creation", "/api/intake", {
        method: "POST",
        authenticated: false,
        body: { title: "Must not persist", teamId: ids.flow },
      })
    ).status,
    401,
  );
  assert.equal(
    sql("SELECT COUNT(*) n FROM issues WHERE title='Must not persist'")[0].n,
    0,
  );
  const input = {
    title: "Emitted API operator evidence",
    teamId: ids.flow,
    description: "**Native intake description**",
    observedAt: "2026-10-02T10:00:00+10:00",
    summary: "Synthetic queue delay observed",
    link: "https://example.test/evidence",
    measurements: { queueSeconds: 17, repeated: true },
    customerReports: [
      {
        customer: "Synthetic API customer",
        summary: "Repeated delay",
        link: "https://example.test/customer",
      },
    ],
    expectedOutcome: "Queue recovers",
    customerImpact: "Synthetic review only",
  };
  const creation = await request(
    "native operator intake create",
    "/api/intake",
    { method: "POST", body: input },
  );
  assert.equal(creation.status, 201);
  const first = creation.json();
  assert.equal(first.version, 1);
  assert.equal(first.status.category, "intake");
  assert.equal(first.description, input.description);
  assert.equal(first.expectedOutcome, input.expectedOutcome);
  assert.equal(first.customerImpact, input.customerImpact);
  assert.equal(first.evidence.length, 1);
  assert.equal(first.evidence[0].originKind, "operator");
  assert.equal(first.evidence[0].actor, "Sarah Chen");
  assert.equal(first.evidence[0].observedAt, "2026-10-02T00:00:00.000Z");
  assert.equal(first.evidence[0].summary, input.summary);
  assert.deepEqual(first.evidence[0].measurements, input.measurements);
  assert.deepEqual(first.evidence[0].customerReports, input.customerReports);
  assert.deepEqual(first.evidence[0].assertions, {});
  assert.equal(first.activity.length, 1);
  assert.equal(first.activity[0].actor, "Sarah Chen");
  assert.ok(
    pending(await current("default Intake in Current"), first.identifier),
  );
  const initialReceipt = receipt(first);
  assert.equal(initialReceipt.evidence[0].actor_operator_id, ids.sarah);
  record(
    "INTAKE-001",
    "Emitted Hono/native-session API commits attributed operator Intake, evidence and creation activity; defaults to Intake/Needs decision.",
  );

  const path = "/api/issues/" + first.identifier;
  const returnAt = new Date(Date.now() + 3600000).toISOString();
  const deferredResponse = await request(
    "defer future Intake",
    path + "/defer",
    {
      method: "POST",
      body: {
        expectedVersion: 1,
        returnAt,
        reason: "Wait for synthetic evidence",
      },
    },
  );
  assert.equal(deferredResponse.status, 200);
  assert.equal(deferredResponse.json().version, 2);
  assert.equal(deferredResponse.json().deferredUntil, returnAt);
  assert.ok(
    !pending(
      await current("deferred Intake hidden from Current"),
      first.identifier,
    ),
  );
  const returnedResponse = await request(
    "manual early deferral return",
    path + "/return",
    { method: "POST", body: { expectedVersion: 2 } },
  );
  assert.equal(returnedResponse.status, 200);
  const returned = returnedResponse.json();
  assert.equal(returned.version, 3);
  assert.equal(returned.deferredUntil, null);
  assert.equal(returned.activity.at(-1).kind, "intake.returned");
  assert.equal(returned.activity.at(-1).actor, "Sarah Chen");
  assert.equal(returned.decisions[0].returnAt, returnAt);
  assert.ok(
    pending(await current("manual return restored Current"), first.identifier),
  );
  const stale = await request(
    "stale manual return rejection",
    path + "/return",
    { method: "POST", body: { expectedVersion: 2 } },
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.json().error, "stale_version");
  assert.equal(stale.json().version, 3);
  const acceptedResponse = await request(
    "accept returned Intake",
    path + "/accept",
    {
      method: "POST",
      body: {
        expectedVersion: 3,
        statusId: ids.started,
        assigneeOperatorId: ids.sarah,
        priority: "high",
        reason: "Begin the synthetic repair",
      },
    },
  );
  assert.equal(acceptedResponse.status, 200);
  const accepted = acceptedResponse.json();
  assert.equal(accepted.version, 4);
  assert.equal(accepted.status.category, "started");
  assert.deepEqual(accepted.evidence, first.evidence);
  assert.equal(accepted.decisions.length, 2);
  assert.equal(accepted.decisions[0].returnAt, returnAt);
  record(
    "INTAKE-005/006/ISSUE-006/007",
    "Future defer hides Intake; manual early return appends operator history once; stale version409; accept commits version4 with original evidence and deferral decision.",
  );

  if (contextSlice) {
    const created = await request(
      "native assigned issue without cycle",
      "/api/issues",
      {
        method: "POST",
        body: {
          title: "Emitted contextual edit",
          teamId: ids.flow,
          statusId: "01J00000000000000000000022",
          assigneeOperatorId: ids.sarah,
        },
      },
    );
    assert.equal(created.status, 201);
    contextIssue = created.json();
    const contextPath = "/api/issues/" + contextIssue.identifier;
    const work = await request(
      "assigned queue reason before context",
      "/api/my-work",
    );
    assert.equal(work.status, 200);
    assert.equal(
      work
        .json()
        .sections.next.find((row) => row.identifier === contextIssue.identifier)
        .primaryReason,
      "assigned-to-you",
    );
    const fields = {
      projectId: "01J00000000000000000000040",
      cycleId: "01J00000000000000000000050",
      estimate: 13,
      dueDate: "2028-02-29",
      labelIds: ["01J00000000000000000000060"],
      expectedOutcome: "  Durable context  ",
      customerImpact: "  Synthetic review  ",
      customFields: {
        nested: { first: 1, second: false },
        array: [0, "retained"],
      },
    };
    const updated = await request("native contextual PATCH", contextPath, {
      method: "PATCH",
      body: { expectedVersion: 1, ...fields },
    });
    assert.equal(updated.status, 200);
    contextIssue = updated.json();
    assert.equal(contextIssue.version, 2);
    assert.equal(contextIssue.project.id, fields.projectId);
    assert.equal(contextIssue.cycle.id, fields.cycleId);
    assert.equal(contextIssue.estimate, 13);
    assert.equal(contextIssue.dueDate, "2028-02-29");
    assert.deepEqual(
      contextIssue.labels.map((label) => label.id),
      fields.labelIds,
    );
    assert.equal(contextIssue.expectedOutcome, "Durable context");
    assert.equal(contextIssue.customerImpact, "Synthetic review");
    assert.deepEqual(contextIssue.customFields, fields.customFields);
    const events = contextIssue.activity.filter(
      (event) => event.kind === "issue.updated",
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].actor, "Sarah Chen");
    assert.equal(events[0].previousValue.projectId, null);
    assert.equal(events[0].nextValue.projectId, fields.projectId);
    const beforeNoop = receipt(contextIssue);
    const noop = await request("semantic contextual no-op", contextPath, {
      method: "PATCH",
      body: {
        expectedVersion: 2,
        labelIds: fields.labelIds,
        customFields: {
          array: [0, "retained"],
          nested: { second: false, first: 1 },
        },
      },
    });
    assert.equal(noop.status, 200);
    assert.equal(noop.json().version, 2);
    assert.deepEqual(receipt(contextIssue), beforeNoop);
    const staleContext = await request("stale contextual PATCH", contextPath, {
      method: "PATCH",
      body: { expectedVersion: 1, estimate: 99 },
    });
    assert.equal(staleContext.status, 409);
    assert.equal(staleContext.json().version, 2);
    assert.deepEqual(receipt(contextIssue), beforeNoop);
    const cleared = await request("clear contextual options", contextPath, {
      method: "PATCH",
      body: {
        expectedVersion: 2,
        projectId: null,
        cycleId: null,
        estimate: null,
        dueDate: null,
        labelIds: [],
        expectedOutcome: null,
        customerImpact: null,
      },
    });
    assert.equal(cleared.status, 200);
    contextIssue = cleared.json();
    assert.equal(contextIssue.version, 3);
    for (const field of [
      "project",
      "cycle",
      "estimate",
      "dueDate",
      "expectedOutcome",
      "customerImpact",
    ])
      assert.equal(contextIssue[field], null);
    assert.deepEqual(contextIssue.labels, []);
    assert.deepEqual(contextIssue.customFields, fields.customFields);
    const afterWork = await request(
      "assigned queue after uncommit",
      "/api/my-work",
    );
    assert.equal(afterWork.status, 200);
    assert.equal(
      afterWork
        .json()
        .sections.next.find((row) => row.identifier === contextIssue.identifier)
        .primaryReason,
      "assigned-to-you",
    );
    contextReceipt = receipt(contextIssue);
    record(
      "ISSUE-002/006/007/011/014/CYCLE-002/WORK-001/002",
      "Emitted native contextual edit atomically persists options/labels/custom JSON with one version/history event; property-order no-op and stale write change nothing; explicit clearing restores truthful assigned queue reason.",
    );
  }

  if (teamSlice) await verifyTeamMoves();

  const dueCreation = await request(
    "second Intake for scheduled return",
    "/api/intake",
    {
      method: "POST",
      body: {
        title: "Cron returns original deferred Intake",
        teamId: ids.flow,
      },
    },
  );
  assert.equal(dueCreation.status, 201);
  const second = dueCreation.json();
  assert.equal(second.evidence[0].summary, second.title);
  assert.equal(second.evidence[0].observedAt, second.createdAt);
  const dueAt = new Date(Date.now() + 2500).toISOString();
  const dueDeferred = await request(
    "second Intake short future defer",
    "/api/issues/" + second.identifier + "/defer",
    {
      method: "POST",
      body: {
        expectedVersion: 1,
        returnAt: dueAt,
        reason: "Real emitted scheduled test",
      },
    },
  );
  assert.equal(dueDeferred.status, 200);
  assert.equal(dueDeferred.json().version, 2);
  const beforeCron = receipt(second);
  assert.equal(beforeCron.issue.deferred_until, dueAt);
  assert.equal(
    beforeCron.activity.filter((event) => event.kind === "intake.returned")
      .length,
    0,
  );
  // No Current GET here: the emitted scheduled handler must perform the return.
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const cronPath =
    "/cdn-cgi/local/scheduled?cron=" + encodeURIComponent("* * * * *");
  const cron = await request("actual emitted scheduled event", cronPath, {
    authenticated: false,
  });
  assert.equal(cron.status, 200);
  const afterCron = receipt(second);
  assert.equal(afterCron.issue.deferred_until, null);
  assert.equal(afterCron.issue.version, 3);
  const events = afterCron.activity.filter(
    (event) => event.kind === "intake.returned",
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].actor_operator_id, null);
  assert.equal(events[0].actor_name, "Deferral return automation");
  assert.deepEqual(JSON.parse(events[0].previous_value_json), {
    deferredUntil: dueAt,
  });
  assert.deepEqual(JSON.parse(events[0].next_value_json), {
    deferredUntil: null,
  });
  assert.deepEqual(afterCron.decisions, beforeCron.decisions);
  assert.deepEqual(afterCron.evidence, beforeCron.evidence);
  assert.equal(
    (
      await request("repeated emitted scheduled event", cronPath, {
        authenticated: false,
      })
    ).status,
    200,
  );
  assert.deepEqual(receipt(second), afterCron);
  evidence.scheduledReceipt = {
    dueAt,
    beforeCron,
    afterCron,
    repeatedCron:
      "Identical stored issue/activity/decisions/evidence; Current was not read before the first scheduled receipt",
  };
  assert.ok(
    pending(
      await current("scheduled return appears in Current"),
      second.identifier,
    ),
  );
  const dueDetail = await request(
    "named scheduled actor read model",
    "/api/issues/" + second.identifier,
  );
  assert.equal(dueDetail.status, 200);
  assert.equal(
    dueDetail.json().activity.at(-1).actor,
    "Deferral return automation",
  );
  record(
    "INTAKE-006",
    "Actual emitted scheduled event clears the due deferral/version exactly once with named automation and unchanged prior decision/evidence before any Current read.",
  );

  if (cycleSlice) await verifyCycleContext();
  if (dependencySlice) {
    const result = await verifyDependencyRuntime({
      request,
      record,
      teamGraph,
      ids,
      evidence,
    });
    finalDependencyIssues = result.issues;
    finalDependencyGraphs = result.graphs;
    dependencyFilePath = result.filePath;
    dependencyFileBytes = result.fileBytes;
  }
  const manualReceipt = receipt(first);
  if (teamSlice) {
    movedGraph = teamGraph(movedIssue);
    assert.deepEqual(receipt(movedIntake), movedIntakeReceipt);
    evidence.teamMove.finalBeforeRestart = {
      ordinary: movedGraph,
      intake: movedIntakeReceipt,
    };
  }
  await stop();
  start();
  await ready();
  assert.deepEqual(receipt(first), manualReceipt);
  assert.deepEqual(receipt(second), afterCron);
  const restarted = await request(
    "native session and accepted issue survive restart",
    path,
  );
  assert.equal(restarted.status, 200);
  assert.equal(restarted.json().version, 4);
  assert.equal(restarted.json().status.category, "started");
  assert.deepEqual(restarted.json().evidence, first.evidence);
  assert.equal(
    (
      await request("scheduled event after restart", cronPath, {
        authenticated: false,
      })
    ).status,
    200,
  );
  assert.deepEqual(receipt(second), afterCron);
  if (contextSlice) {
    assert.deepEqual(receipt(contextIssue), contextReceipt);
    const contextRestart = await request(
      "context survives restart",
      "/api/issues/" + contextIssue.identifier,
    );
    assert.equal(contextRestart.status, 200);
    assert.deepEqual(contextRestart.json(), contextIssue);
    evidence.contextReceipt = { final: contextReceipt };
    record(
      "CONTEXT-PERSISTENCE",
      "Native contextual metadata, custom JSON, explicit clears and both immutable actor events survive an owned emitted Worker restart.",
    );
  }
  if (teamSlice) {
    assert.deepEqual(teamGraph(movedIssue), movedGraph);
    assert.deepEqual(receipt(movedIntake), movedIntakeReceipt);
    for (const saved of [movedIssue, movedIntake]) {
      const restarted = await request(
        "moved " + saved.identifier + " survives owned Worker restart",
        "/api/issues/" + saved.identifier,
      );
      assert.equal(restarted.status, 200);
      assert.deepEqual(restarted.json(), saved);
    }
    const discussion = await request(
      "moved discussion survives restart",
      "/api/issues/" + movedIssue.identifier + "/discussion",
    );
    assert.equal(discussion.status, 200);
    assert.deepEqual(discussion.json(), movedDiscussion);
    const bytes = await request(
      "original private moved bytes survive restart",
      movedFilePath,
    );
    assert.equal(bytes.status, 200);
    assert.deepEqual(Buffer.from(bytes.bytes), movedFileBytes);
    const anonymous = await request(
      "restarted moved file stays private",
      movedFilePath,
      { authenticated: false },
    );
    assert.equal(anonymous.status, 401);
    assert.ok(!anonymous.text.includes("Original private move evidence"));
    evidence.teamMove.restart = {
      ordinary: teamGraph(movedIssue),
      intake: receipt(movedIntake),
      fileSha256: createHash("sha256").update(bytes.bytes).digest("hex"),
    };
    record(
      "TEAM-MOVE-PERSISTENCE",
      "Native session, both moved records/versions/history, retained metadata and dependency/comment/link graph, original private R2 bytes and target Intake acceptance survive an owned emitted Worker restart alongside original intake/context assertions.",
    );
  }
  if (cycleSlice) {
    const result = await request(
      "cycle context after owned restart",
      "/api/my-work",
    );
    assert.equal(result.status, 200);
    assert.deepEqual(
      result.json().cycles.find((row) => row.id === finalCycleContext.id),
      finalCycleContext,
    );
    record(
      "CYCLE-CONTEXT-PERSISTENCE",
      "Actual native cycle progress/unit/capacity/timezone read model survives an owned emitted Worker restart.",
    );
  }
  if (dependencySlice) {
    for (let index = 0; index < finalDependencyIssues.length; index++) {
      const issue = finalDependencyIssues[index];
      assert.deepEqual(teamGraph(issue), finalDependencyGraphs[index]);
      const response = await request(
        "native dependency record after owned restart",
        "/api/issues/" + issue.identifier,
      );
      assert.equal(response.status, 200);
      assert.deepEqual(response.json(), issue);
    }
    const work = await request(
      "native dependency Waiting after owned restart",
      "/api/my-work",
    );
    assert.equal(work.status, 200);
    assert.ok(
      work
        .json()
        .sections.waiting.some(
          (row) => row.identifier === finalDependencyIssues[0].identifier,
        ),
    );
    const file = await request(
      "native dependency private file after restart",
      dependencyFilePath,
    );
    assert.equal(file.status, 200);
    assert.deepEqual(Buffer.from(file.bytes), dependencyFileBytes);
    const anonymous = await request(
      "anonymous dependency file denial after restart",
      dependencyFilePath,
      { authenticated: false },
    );
    assert.equal(anonymous.status, 401);
    assert.ok(
      !anonymous.text.includes("Private synthetic dependency evidence"),
    );
    evidence.dependencies.restart = {
      graphs: finalDependencyIssues.map(teamGraph),
      waiting: true,
    };
    record(
      "DEPENDENCY-PERSISTENCE",
      "Both native endpoint versions/histories, directed graph, dependent Waiting and retained issue metadata survive an owned emitted Worker restart with the original auth/intake/context/team/private-byte/cycle assertions.",
    );
  }
  evidence.manualReceipt = { initial: initialReceipt, final: manualReceipt };
  record(
    "LOCAL-PERSISTENCE",
    "Native session, both Intake records, evidence, old deferral decisions and operator/automation history survive owned emitted Worker restart; repeated Cron adds nothing.",
  );
  const afterEmission = await emission();
  assert.equal(
    afterEmission.manifestSha256,
    evidence.emission.manifestSha256,
    "Emission changed during runtime proof",
  );
  evidence.emissionStable = true;
  evidence.passed = true;
} catch (error) {
  evidence.error = String(error.stack);
  process.exitCode = 1;
  await writeFile(
    resolve(evidenceDirectory, evidenceName + "-failure-" + runId + ".log"),
    evidence.error + "\n" + workerLog,
  );
} finally {
  try {
    await stop();
    evidence.ownedWorkerStopped = true;
  } catch (error) {
    evidence.passed = false;
    evidence.cleanupError = String(error.stack);
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  await writeFile(resolve(logDirectory + "-worker.log"), workerLog);
  await writeFile(
    resolve(evidenceDirectory, evidenceName + ".json"),
    JSON.stringify(evidence, null, 2),
  );
  console.info(
    JSON.stringify(
      {
        passed: evidence.passed,
        checks: evidence.checks.length,
        error: evidence.error,
        evidence: resolve(evidenceDirectory, evidenceName + ".json"),
        state,
        ownedWorkerStopped: evidence.ownedWorkerStopped,
      },
      null,
      2,
    ),
  );
}
