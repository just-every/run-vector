import test from "node:test";
import assert from "node:assert/strict";
import { canSelectCycle } from "../src/core/features/cycles/ui/commitment-choices.ts";

test("terminal cycle choices preserve an existing commitment and permit uncommit", () => {
  for (const category of ["completed", "canceled", "duplicate"]) {
    assert.equal(canSelectCycle(category, "current", "different"), false);
    assert.equal(canSelectCycle(category, "current", "current"), true);
    assert.equal(canSelectCycle(category, "current", null), true);
    assert.equal(canSelectCycle(category, null, "new"), false);
  }
  for (const category of ["intake", "backlog", "unstarted", "started"]) {
    assert.equal(canSelectCycle(category, null, "new"), true);
    assert.equal(canSelectCycle(category, "current", "different"), true);
  }
});
