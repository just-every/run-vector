import assert from "node:assert/strict";
import { test } from "node:test";
import { fromMarkdown } from "mdast-util-from-markdown";
import {
  mentionToken,
  decodeMentionToken,
} from "../src/core/features/notifications/mention-token.ts";
import {
  markdownMentions,
  remarkMentions,
} from "../src/core/features/notifications/mention-markdown.ts";
import { contractWith } from "./contract-tags.ts";
const id = "01J00000000000000000000001",
  token = mentionToken({ id, name: "A <B> & C" });
contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "canonical selected IDs target only ordinary CommonMark text",
  () => {
    assert.deepEqual(decodeMentionToken(token), { id, name: "A <B> & C" });
    const parse = (body: string) =>
      markdownMentions(fromMarkdown(body), body).map((m) => m.id);
    assert.deepEqual(parse(`Hello **${token}**`), [id]);
    for (const body of [
      `\\${token}`,
      `\`${token}\``,
      `\`\`\`\n${token}\n\`\`\``,
      `    ${token}`,
      `[${token}](https://example.test)`,
      `![${token}](https://example.test)`,
      `<span>${token}</span>`,
      `<div>\n${token}\n</div>`,
      `someone${token}@example.test`,
      `email@${token}`,
      `@{${id}|bad%zz}`,
      `@{unknown|A}`,
      `&#64;{${id}|A}`,
    ])
      assert.deepEqual(parse(body), [], body);
    assert.deepEqual(parse(`earlier \\* text ${token}`), [id]);
    assert.deepEqual(parse(`*a* ${token}\n\n${token}`), [id, id]);
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "rendering transforms only selected raw occurrences alongside escaped and entity-produced identical tokens",
  () => {
    const selected = mentionToken({ id, name: "Alice &copy; \\ name" });
    const source = `\\${selected} &#64;${selected.slice(1)} ${selected}. ${selected}`;
    const tree = fromMarkdown(source);
    assert.equal(markdownMentions(tree, source).length, 2);
    remarkMentions({ operatorIds: [id] })(tree, { value: source });
    const text = (tree.children[0] as any).children
      .map((n: any) => n.value)
      .join("");
    assert.equal(
      text,
      `${selected} ${selected} @Alice &copy; \\ name. @Alice &copy; \\ name`,
    );
    const unknown = fromMarkdown(selected);
    remarkMentions({ operatorIds: [] })(unknown, { value: selected });
    assert.equal((unknown.children[0] as any).children[0].value, selected);
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "mention labels accept existing 200-character owner names and controls and Unicode as safely encoded text",
  () => {
    for (const name of [
      "O".repeat(200),
      "Alice\nOps\u0000 team",
      "日本語 👩🏽‍💻 <script> &copy;",
    ]) {
      const token = mentionToken({ id, name });
      assert.deepEqual(decodeMentionToken(token), { id, name });
      assert.equal(/[<>\x00-\x1f]/.test(token), false);
      const tree = fromMarkdown(token);
      assert.equal(markdownMentions(tree, token).length, 1);
      remarkMentions({ operatorIds: [id] })(tree, { value: token });
      assert.equal((tree.children[0] as any).children[0].value, "@" + name);
    }
    assert.equal(
      decodeMentionToken(mentionToken({ id, name: "Unpaired \ud800" }))?.name,
      "Unpaired \ufffd",
    );
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "quoted mailbox local parts remain literal while quoted prose mentions render",
  () => {
    for (const source of [
      `"${token}"@example.test`,
      `"prefix ${token} suffix"@example.test`,
      `"${token} ${token}"@example.test`,
      `"prefix \\" ${token} suffix"@example.test`,
      `"${token}"@[127.0.0.1]`,
    ]) {
      const tree = fromMarkdown(source);
      assert.deepEqual(markdownMentions(tree, source), [], source);
      const before = JSON.stringify(tree);
      remarkMentions({ operatorIds: [id] })(tree, { value: source });
      assert.equal(JSON.stringify(tree), before);
    }
    const source = `She wrote "${token}" in ordinary prose. "${token}"@example.test`;
    const tree = fromMarkdown(source);
    assert.deepEqual(
      markdownMentions(tree, source).map((mention) => mention.id),
      [id],
    );
    remarkMentions({ operatorIds: [id] })(tree, { value: source });
    assert.equal(
      (tree.children[0] as any).children[0].value,
      `She wrote "@A <B> & C" in ordinary prose. "${token}"@example.test`,
    );
  },
);
