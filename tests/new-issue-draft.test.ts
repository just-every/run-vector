import assert from "node:assert/strict";
import test from "node:test";
import {
  createIssuePayload,
  createIntakePayload,
  emptyNewIssueDraft,
  hasUnsavedDraft,
  newIssueDraftKey,
  parseNewIssueDraft,
} from "../src/core/features/issues/ui/new-issue-draft.ts";

test("unsent issue drafts are keyed to the operator and workspace and validate before restore", () => {
  assert.equal(
    newIssueDraftKey("workspace-1", "operator-1"),
    "vector:new-issue-draft:workspace-1:operator-1",
  );
  assert.equal(hasUnsavedDraft(emptyNewIssueDraft), false);
  assert.equal(parseNewIssueDraft({ title: "Missing fields" }), null);
  const draft = {
    ...emptyNewIssueDraft,
    title: "Restore contextual issue",
    teamId: "01J00000000000000000000010",
    labelIds: ["01J00000000000000000000060"],
    estimate: "8",
    priority: "high" as const,
  };
  assert.deepEqual(parseNewIssueDraft(draft), draft);
  assert.equal(hasUnsavedDraft(draft), true);
});

test("issue payload keeps optional fields explicit without creating a draft record", () => {
  const payload = createIssuePayload({
    ...emptyNewIssueDraft,
    title: "Create later",
    teamId: "01J00000000000000000000010",
    estimate: "5",
    dueDate: "2026-09-01",
  });
  assert.deepEqual(payload, {
    title: "Create later",
    teamId: "01J00000000000000000000010",
    description: "",
    assigneeOperatorId: null,
    projectId: null,
    cycleId: null,
    priority: "none",
    labelIds: [],
    estimate: 5,
    dueDate: "2026-09-01",
    expectedOutcome: null,
    customerImpact: null,
  });
});

test("operator evidence drafts preserve false/zero, restore old issue drafts, and reject lossy duplicate measurements", () => {
  const old = JSON.parse(JSON.stringify(emptyNewIssueDraft));
  delete old.mode;
  delete old.intakeObservedAt;
  delete old.intakeSummary;
  delete old.intakeLink;
  delete old.intakeMeasurements;
  delete old.intakeCustomerReports;
  assert.equal(parseNewIssueDraft(old)?.mode, "issue");
  const draft = {
    ...emptyNewIssueDraft,
    mode: "intake" as const,
    title: "Observed queue delay",
    teamId: "01J00000000000000000000010",
    intakeMeasurements: [
      { name: "delay", value: "0", type: "number" as const },
      { name: "affected", value: "false", type: "boolean" as const },
    ],
    intakeCustomerReports: [
      {
        customer: "Synthetic",
        summary: "Observed delay",
        link: "https://example.test/report",
      },
    ],
  };
  const payload = createIntakePayload(draft);
  assert.deepEqual({ ...payload.measurements }, { delay: 0, affected: false });
  assert.equal("actorOperatorId" in payload, false);
  assert.equal("sourceId" in payload, false);
  assert.equal("observedAt" in payload, false);
  assert.throws(
    () =>
      createIntakePayload({
        ...draft,
        intakeMeasurements: [
          { name: "delay", value: "1", type: "number" },
          { name: " delay ", value: "2", type: "number" },
        ],
      }),
    /unique|duplicate/i,
  );
  assert.throws(
    () => createIntakePayload({ ...draft, intakeLink: "javascript:alert(1)" }),
    /HTTPS/,
  );
});
