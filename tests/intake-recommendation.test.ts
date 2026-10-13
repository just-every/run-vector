import assert from "node:assert/strict";
import { test } from "node:test";
import { intakeRecommendation } from "../src/core/features/issues/ui/intake-recommendation.ts";
const options = {
  operators: [{ id: "person", name: "Person" }],
  statuses: [
    { id: "ready", teamId: "team", category: "unstarted", position: 0 },
    { id: "active", teamId: "team", category: "started", position: 1 },
  ],
  cycles: [{ id: "cycle", teamId: "team" }],
} as any;
const issue = (assertions: Record<string, unknown>) =>
  ({
    team: { id: "team" },
    evidence: [
      { observedAt: "2026-01-01", receivedAt: "2026-01-01", assertions },
    ],
  }) as any;
test("absent recommendation uses contract defaults", () => {
  assert.deepEqual(intakeRecommendation(issue({}), options), {
    assigneeOperatorId: "",
    priority: "none",
    statusId: "",
    cycleId: "",
    recommended: {
      assignee: false,
      priority: false,
      status: false,
      cycle: false,
    },
  });
});
test("explicit policy values populate every editable choice", () => {
  const result = intakeRecommendation(
    issue({
      recommendation: {
        source: "policy",
        assigneeOperatorId: "person",
        priority: "low",
        statusCategory: "started",
        cycleId: "cycle",
      },
    }),
    options,
  );
  assert.deepEqual(result, {
    assigneeOperatorId: "person",
    priority: "low",
    statusId: "active",
    cycleId: "cycle",
    recommended: { assignee: true, priority: true, status: true, cycle: true },
  });
});
test("partial recommendations never invent missing assertions", () => {
  const result = intakeRecommendation(
    issue({ recommendation: { source: "policy", priority: "medium" } }),
    options,
  );
  assert.equal(result.priority, "medium");
  assert.equal(result.statusId, "");
  assert.equal(result.assigneeOperatorId, "");
  assert.equal(result.cycleId, "");
  assert.equal(result.recommended.assignee, false);
});
test("invalid or unavailable recommendations cannot set choices", () => {
  assert.equal(
    intakeRecommendation(
      issue({ recommendation: { source: "source", priority: "high" } }),
      options,
    ).priority,
    "none",
  );
  assert.equal(
    intakeRecommendation(
      issue({
        recommendation: {
          source: "policy",
          assigneeOperatorId: "removed",
          cycleId: "foreign",
        },
      }),
      options,
    ).cycleId,
    "",
  );
});
test("a newer evidence revision without a recommendation resets defaults", () => {
  const record = issue({
    recommendation: { source: "policy", priority: "high" },
  });
  record.evidence.push({
    observedAt: "2026-02-01",
    receivedAt: "2026-02-01",
    assertions: {},
  });
  assert.equal(intakeRecommendation(record, options).priority, "none");
});
