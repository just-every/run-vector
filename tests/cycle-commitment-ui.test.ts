import assert from "node:assert/strict";
import { contract } from "./contract.ts";
import { canSelectCycle } from "../src/core/features/cycles/ui/commitment-choices.ts";

contract(
  "CYCLE-002",
  "cycle controls retain and uncommit terminal commitments without offering a new commitment",
  () => {
    for (const category of ["completed", "canceled", "duplicate"]) {
      assert.equal(canSelectCycle(category, "first", "first"), true);
      assert.equal(canSelectCycle(category, "first", null), true);
      assert.equal(canSelectCycle(category, "first", "second"), false);
      assert.equal(canSelectCycle(category, null, "first"), false);
    }
  },
);
contract(
  "CYCLE-002",
  "cycle controls allow nonterminal issues to commit and move between eligible cycles",
  () => {
    for (const category of ["intake", "backlog", "unstarted", "started"]) {
      assert.equal(canSelectCycle(category, null, "first"), true);
      assert.equal(canSelectCycle(category, "first", "second"), true);
      assert.equal(canSelectCycle(category, "first", null), true);
    }
  },
);
