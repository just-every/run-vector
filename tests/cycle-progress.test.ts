import assert from "node:assert/strict";
import test from "node:test";
import { calculateCycleProgress } from "../src/core/features/cycles/progress.ts";

test("[CYCLE-003] estimated scope uses weighted points and excludes canceled/duplicate work", () => {
  const issues = Object.freeze([
    Object.freeze({ category: "completed", estimate: 2 }),
    Object.freeze({ category: "started", estimate: 5 }),
    Object.freeze({ category: "backlog", estimate: 1 }),
    Object.freeze({ category: "canceled", estimate: null }),
    Object.freeze({ category: "duplicate", estimate: 100 }),
  ]);
  assert.deepEqual(calculateCycleProgress(issues, 6), {
    completed: 2,
    total: 8,
    unit: "points",
    percentage: 25,
    capacity: 6,
    capacityRisk: "within-capacity",
    remainingPoints: 6,
    unestimatedRemaining: 0,
  });
  assert.equal(calculateCycleProgress(issues, 5).capacityRisk, "at-risk");
});

test("[CYCLE-003] an unestimated completed issue changes progress units without hiding known remaining points", () => {
  const issues = [
    { category: "completed", estimate: null },
    { category: "unstarted", estimate: 8 },
    { category: "intake", estimate: 3 },
  ];
  assert.deepEqual(calculateCycleProgress(issues, 10), {
    completed: 1,
    total: 3,
    unit: "issue-count",
    percentage: (1 / 3) * 100,
    capacity: 10,
    capacityRisk: "at-risk",
    remainingPoints: 11,
    unestimatedRemaining: 0,
  });
  assert.equal(
    calculateCycleProgress(issues, 11).capacityRisk,
    "within-capacity",
  );
});

test("[CYCLE-003] unknown remaining estimates and absent capacity stay explicit", () => {
  const issues = [
    { category: "completed", estimate: 5 },
    { category: "started", estimate: null },
    { category: "backlog", estimate: null },
  ];
  const result = calculateCycleProgress(issues, 100);
  assert.equal(result.unit, "issue-count");
  assert.equal(result.percentage, (1 / 3) * 100);
  assert.equal(result.capacityRisk, "unknown");
  assert.equal(result.remainingPoints, null);
  assert.equal(result.unestimatedRemaining, 2);
  const noCapacity = calculateCycleProgress(
    [{ category: "started", estimate: 8 }],
    null,
  );
  assert.equal(noCapacity.capacityRisk, "unknown");
  assert.equal(noCapacity.remainingPoints, 8);
  assert.equal(noCapacity.capacity, null);
});

test("[CYCLE-003] empty scope has no percentage and zero capacity is a known boundary", () => {
  for (const issues of [
    [],
    [
      { category: "canceled", estimate: null },
      { category: "duplicate", estimate: 10 },
    ],
  ]) {
    assert.deepEqual(calculateCycleProgress(issues, 0), {
      completed: 0,
      total: 0,
      unit: "points",
      percentage: null,
      capacity: 0,
      capacityRisk: "within-capacity",
      remainingPoints: 0,
      unestimatedRemaining: 0,
    });
  }
  assert.equal(calculateCycleProgress([], null).capacityRisk, "unknown");
  assert.equal(
    calculateCycleProgress([{ category: "started", estimate: 1 }], 0)
      .capacityRisk,
    "at-risk",
  );
  assert.equal(
    calculateCycleProgress([{ category: "completed", estimate: null }], 0)
      .capacityRisk,
    "within-capacity",
  );
});
