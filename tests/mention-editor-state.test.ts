import assert from "node:assert/strict";
import test from "node:test";
import { mentionToken } from "../src/core/features/notifications/mention-token.ts";
import {
  canonicalMentionBody,
  projectMentionBody,
  editMentionText,
  selectEditorMention,
  mentionQuery,
  reprojectMentionCaret,
} from "../src/core/features/notifications/ui/mention-editor-state.ts";
const alice = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", name: "Alice Smith" };
const other = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAW", name: "Alice Smith" };
test("ISSUE-013 readable editing round-trips canonical identities and Markdown exactly", () => {
  const body = `**Hi** ${mentionToken(alice)} and ${mentionToken(other)}\n\n\`literal\` [link](https://example.test)`;
  const state = projectMentionBody(body, [alice.id, other.id]);
  assert.equal(
    state.text,
    "**Hi** @Alice Smith and @Alice Smith\n\n`literal` [link](https://example.test)",
  );
  assert.equal(canonicalMentionBody(state), body);
  assert.equal(
    canonicalMentionBody(editMentionText(state, "Before " + state.text)),
    "Before " + body,
  );
  const after = editMentionText(state, state.text.replace(" and ", " or "));
  assert.equal(canonicalMentionBody(after), body.replace(" and ", " or "));
});
test("ISSUE-013 an edited mention becomes literal without retargeting the identical name", () => {
  const body = `${mentionToken(alice)} and ${mentionToken(other)}`;
  const state = projectMentionBody(body, [alice.id, other.id]);
  const changed = editMentionText(
    state,
    state.text.replace("@Alice Smith", "@Alicia"),
  );
  assert.equal(
    canonicalMentionBody(changed),
    `@Alicia and ${mentionToken(other)}`,
  );
  const pasted = editMentionText(state, state.text + " @Alice Smith");
  assert.equal(canonicalMentionBody(pasted), body + " @Alice Smith");
});
test("ISSUE-013 selection inserts at the caret and preserves later text and other identities", () => {
  const state = projectMentionBody(
    `First @Al middle ${mentionToken(other)} end`,
    [alice.id, other.id],
  );
  const query = mentionQuery(state.text, 9)!;
  assert.deepEqual(query, { start: 6, end: 9, query: "Al" });
  const next = selectEditorMention(state, query.start, query.end, alice);
  assert.equal(
    canonicalMentionBody(next),
    `First ${mentionToken(alice)}  middle ${mentionToken(other)} end`,
  );
  assert.equal(mentionQuery("a@Al", 4), null);
  assert.equal(mentionQuery("alice@example.test", 18), null);
  assert.equal(mentionQuery("hello @", 7)?.query, "");
});
test("ISSUE-013 malformed tokens and literal names retain their source", () => {
  const body = "@Alice @{unknown|Alice} @{01ARZ3NDEKTSV4RRFFQ69G5FAV|%ZZ}";
  assert.equal(
    canonicalMentionBody(projectMentionBody(body, [alice.id, other.id])),
    body,
  );
});

test("ISSUE-013 unknown and removed identities remain exact visible source", () => {
  const body = mentionToken(alice);
  const unknown = projectMentionBody(body, []);
  assert.equal(unknown.text, body);
  assert.equal(canonicalMentionBody(unknown), body);
});

test("ISSUE-013 an active-identity refresh preserves the caret in following Markdown", () => {
  const body = mentionToken(alice) + " middle text";
  const literal = projectMentionBody(body, []);
  const readable = projectMentionBody(body, [alice.id]);
  assert.equal(
    reprojectMentionCaret(literal, readable, body.length - 4),
    readable.text.length - 4,
  );
  assert.equal(
    reprojectMentionCaret(readable, literal, readable.text.length - 4),
    body.length - 4,
  );
});

test("ISSUE-013 deleting the first of two identical display names retains the second identity", () => {
  const state = projectMentionBody(
    `${mentionToken(alice)} and ${mentionToken(other)}`,
    [alice.id, other.id],
  );
  const changed = editMentionText(state, "@Alice Smith", {
    start: 0,
    end: state.mentions[1].start,
    inputType: "deleteContentForward",
  });
  assert.equal(canonicalMentionBody(changed), mentionToken(other));
});

test("ISSUE-013 existing long Unicode and control-containing names round-trip without tightening the operator domain", () => {
  for (const name of ["A".repeat(200), "Alice\n\u0000𝒜 <script>"]) {
    const mention = { ...alice, name };
    const body = mentionToken(mention);
    const state = projectMentionBody(body, [alice.id]);
    assert.equal(state.text, "@" + name);
    assert.equal(canonicalMentionBody(state), body);
  }
});

test("ISSUE-013 full prefixes use the existing 200-character operator-name domain", () => {
  const name = "A".repeat(200);
  assert.equal(mentionQuery("@" + name, 201)?.query, name);
});

test("ISSUE-013 unrelated operator additions preserve a caret inside an unchanged readable mention", () => {
  const body = mentionToken(alice) + " following Markdown";
  const before = projectMentionBody(body, [alice.id]);
  const after = projectMentionBody(body, [alice.id, other.id]);
  assert.equal(reprojectMentionCaret(before, after, 5), 5);
});
