import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { fromMarkdown } from "mdast-util-from-markdown";
import { remarkMentions } from "../src/core/features/notifications/mention-markdown.ts";
import { mentionToken } from "../src/core/features/notifications/mention-token.ts";
import { contractWith } from "./contract-tags.ts";

const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const token = mentionToken({ id, name: "Maya Ortiz" });
const chip = '<span class="mention-chip">@Maya Ortiz</span>';
function render(source: string, operatorIds: string[] = [id]) {
  return renderToStaticMarkup(
    createElement(Markdown, {
      children: source,
      skipHtml: true,
      remarkPlugins: [[remarkMentions, { operatorIds }]],
    }),
  );
}

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "active native mentions render as readable chips inside ordinary Markdown",
  () => {
    const source = `Hello ${token}. **${token}**\n\n> ${token}\n\n- ${token}`;
    const html = render(source);
    assert.equal(html.split(chip).length - 1, 4);
    assert.match(html, /<strong>/);
    assert.match(html, /<blockquote>/);
    assert.match(html, /<li>/);
    assert.ok(!html.includes(id));
    assert.ok(!html.includes("href="));
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "mention chip transform preserves aggregate readable Markdown text",
  () => {
    const source = `Before ${token}, after ${token}.`;
    const tree = fromMarkdown(source);
    remarkMentions({ operatorIds: [id] })(tree, { value: source });
    const paragraph = tree.children[0];
    assert.equal(paragraph.type, "paragraph");
    if (paragraph.type !== "paragraph") throw new Error("Expected paragraph");
    const text = paragraph.children[0];
    assert.equal(text.type, "text");
    if (text.type !== "text") throw new Error("Expected text");
    assert.equal(text.value, "Before @Maya Ortiz, after @Maya Ortiz.");
    assert.equal(render(source).split(chip).length - 1, 2);
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "escaped and entity-made identical tokens cannot receive a later native mention chip",
  () => {
    const source = `\\${token} &#64;${token.slice(1)} ${token}. ${token}`;
    const html = render(source);
    assert.equal(html.split(chip).length - 1, 2);
    assert.equal(html.split(token).length - 1, 2);
    assert.ok(html.indexOf(token) < html.indexOf(chip));
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "only structurally valid active native mentions can create chip markup",
  () => {
    const excluded = [
      "@Maya Ortiz",
      `\\${token}`,
      `\`${token}\``,
      `\`\`\`\n${token}\n\`\`\``,
      `    ${token}`,
      `[${token}](https://example.test)`,
      `[${token}][person]\n\n[person]: https://example.test`,
      `![${token}](https://example.test)`,
      `![${token}][person]\n\n[person]: https://example.test`,
      `<span>${token}</span>`,
      `<span class="mention-chip">${token}</span>`,
      `<div>\n${token}\n</div>`,
      `<span>${token}`,
      `someone${token}@example.test`,
      `email@${token}`,
      `${token}@example.test`,
      `${token}.example.test`,
      `"prefix ${token} suffix"@example.test`,
      `"${token} ${token}"@example.test`,
      `"prefix \\" ${token} suffix"@example.test`,
      `"${token}"@[127.0.0.1]`,
      `&#64;${token.slice(1)}`,
      `@{${id}|bad%zz}`,
      "@{unknown|Maya}",
    ];
    for (const source of excluded)
      assert.ok(!render(source).includes('class="mention-chip"'), source);
    assert.ok(!render(token, []).includes('class="mention-chip"'));
    assert.ok(render(token, []).includes(token));
    assert.equal(render(`She wrote "${token}".`).split(chip).length - 1, 1);
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "mention labels remain inert text rather than HTML, links, or images",
  () => {
    const name =
      '<img src="https://tracker.test/pixel" onerror="alert(1)"> <script>alert(1)</script> [Open](javascript:alert(1)) ![pixel](https://tracker.test/pixel) &copy;';
    const html = render(mentionToken({ id, name }));
    assert.equal(html.split('class="mention-chip"').length - 1, 1);
    assert.ok(html.includes("&lt;img"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("&amp;copy;"));
    assert.deepEqual(html.match(/<[^>]+>/g), [
      "<p>",
      "<span>",
      '<span class="mention-chip">',
      "</span>",
      "</span>",
      "</p>",
    ]);
  },
);

contractWith(
  test,
  "ISSUE-013 BASE-INPUT-002",
  "mention labels are not parsed again and adjacent soft breaks remain readable",
  () => {
    const nestedName = `Maya ${token}`;
    const html = render(
      `Before\n  ${mentionToken({ id, name: nestedName })}\n  after`,
    );
    assert.equal(html.split('class="mention-chip"').length - 1, 1);
    assert.ok(html.includes(`@${nestedName}</span>`));
    assert.match(html, /Before\s+<span class="mention-chip">/);
    assert.match(html, /<\/span>\s+after/);
  },
);
