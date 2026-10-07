import assert from "node:assert/strict";
import test from "node:test";
import {
  filterItems,
  moveRowFocus,
  reasonLabel,
} from "../src/core/features/streams/ui/helpers.ts";
import type { StreamItem } from "../src/core/features/streams/ui/data.ts";

function item(overrides: Partial<StreamItem> = {}): StreamItem {
  return {
    id: "01J00000000000000000000001",
    identifier: "FLW-842",
    title: "Evidence-backed triage",
    status: {
      id: "01J00000000000000000000002",
      name: "Intake",
      category: "intake",
    },
    priority: "high",
    dueDate: null,
    updatedAt: "2026-08-31T12:00:00.000Z",
    assignee: null,
    project: null,
    team: {
      id: "01J00000000000000000000003",
      name: "Flow",
      identifierPrefix: "FLW",
    },
    primaryReason: "awaiting-decision",
    contextReasons: ["new-evidence"],
    ...overrides,
  };
}

test("stream filters use real stream item fields without changing their section order", () => {
  const assigned = item({
    id: "02",
    identifier: "PLT-101",
    priority: "urgent",
    team: { id: "team-platform", name: "Platform", identifierPrefix: "PLT" },
    assignee: { id: "maya", name: "Maya Ortiz" },
  });
  const unassigned = item();
  assert.deepEqual(
    filterItems([assigned, unassigned], {
      teamId: "all",
      assigneeId: "unassigned",
      priority: "all",
    }).map((entry) => entry.identifier),
    ["FLW-842"],
  );
  assert.deepEqual(
    filterItems([assigned, unassigned], {
      teamId: "team-platform",
      assigneeId: "maya",
      priority: "urgent",
    }).map((entry) => entry.identifier),
    ["PLT-101"],
  );
});

test("stream keyboard focus never moves outside the visible list", () => {
  assert.equal(moveRowFocus(0, "previous", 3), 0);
  assert.equal(moveRowFocus(1, "next", 3), 2);
  assert.equal(moveRowFocus(2, "next", 3), 2);
  assert.equal(moveRowFocus(0, "next", 0), -1);
});

test("reason labels preserve the explainable projection vocabulary", () => {
  assert.equal(reasonLabel("assigned-to-you"), "Assigned to you");
  assert.equal(reasonLabel("unresolved-dependency"), "Unresolved dependency");
  assert.equal(reasonLabel("customer-escalation"), "Customer escalation");
  assert.equal(reasonLabel("due-within-seven-days"), "Due within 7 days");
});
