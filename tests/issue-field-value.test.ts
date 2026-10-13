import assert from "node:assert/strict";
import test from "node:test";
import {
  issueFieldPayload,
  type EditableIssueField,
} from "../src/core/features/issues/ui/issue-field-value.ts";

test("ISSUE-006 ISSUE-007 each inline draft changes only its field at its original version", () => {
  const cases: [EditableIssueField, string, string | number][] = [
    ["estimate", "13", 13],
    ["dueDate", "2028-02-29", "2028-02-29"],
    [
      "expectedOutcome",
      "  Resolve the queue\nwithout dropping events.  ",
      "Resolve the queue\nwithout dropping events.",
    ],
    ["customerImpact", "Customers can sign in.", "Customers can sign in."],
  ];
  for (const [field, draft, expected] of cases) {
    assert.deepEqual(issueFieldPayload(7, field, draft), {
      expectedVersion: 7,
      [field]: expected,
    });
  }
});

test("ISSUE-007 ISSUE-011 clear optional fields explicitly instead of omitting changes", () => {
  for (const field of [
    "estimate",
    "dueDate",
    "expectedOutcome",
    "customerImpact",
  ] as const)
    for (const empty of ["", " \n\t "])
      assert.deepEqual(issueFieldPayload(3, field, empty), {
        expectedVersion: 3,
        [field]: null,
      });
});

test("ISSUE-011 estimates enforce whole points and bounds without coercing invalid drafts", () => {
  for (const valid of ["1", "100"])
    assert.equal(
      issueFieldPayload(1, "estimate", valid).estimate,
      Number(valid),
    );
  for (const invalid of ["0", "-1", "101", "1.5", "NaN", "Infinity", "five"])
    assert.throws(
      () => issueFieldPayload(1, "estimate", invalid),
      /whole number/,
    );
});

test("ISSUE-007 due date uses a calendar date and rejects impossible dates; long text is not truncated", () => {
  for (const invalid of [
    "2027-02-29",
    "2028-13-01",
    "2028-01-32",
    "2028-01-01T00:00:00Z",
  ])
    assert.throws(
      () => issueFieldPayload(1, "dueDate", invalid),
      /valid due date/,
    );
  assert.equal(
    issueFieldPayload(1, "expectedOutcome", "x".repeat(20000)).expectedOutcome,
    "x".repeat(20000),
  );
  assert.throws(
    () => issueFieldPayload(1, "customerImpact", "x".repeat(20001)),
    /20,000/,
  );
});
