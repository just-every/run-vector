import { decodeString } from "micromark-util-decode-string";
import { markdownMentions, type MentionNode } from "../notifications/mention-markdown";

export type IssueReferenceSpan = { identifier: string; start: number; end: number };
const boundary = /[\p{L}\p{N}_@-]/u;
const excludedNodes = new Set(["link", "linkReference", "image", "imageReference", "code", "inlineCode", "definition"]);
const voidTags = new Set(["br", "hr", "img", "input", "meta", "link", "wbr", "source", "area", "base", "col", "embed", "param", "track"]);

/** Source spans in prose only. Escapes/entities, code, links and HTML cannot
 * manufacture references or cause destinations to become backlink subjects. */
export function markdownIssueReferences(tree: MentionNode, source: string): IssueReferenceSpan[] {
  const found: IssueReferenceSpan[] = [], html: string[] = [];
  const mentions = markdownMentions(tree, source);
  function visit(node: MentionNode, excluded = false) {
    if (node.type === "html") {
      for (const tag of (node.value ?? "").matchAll(/<\s*(\/?)\s*([A-Za-z][\w:-]*)\b[^>]*>/g)) {
        const name = tag[2].toLowerCase();
        if (tag[1]) { const at = html.lastIndexOf(name); if (at >= 0) html.splice(at); }
        else if (!/\/\s*>$/.test(tag[0]) && !voidTags.has(name)) html.push(name);
      }
      return;
    }
    const skip = excluded || excludedNodes.has(node.type);
    if (node.type === "text" && !skip && html.length === 0) {
      const start = node.position?.start.offset, end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) {
        const raw = source.slice(start, end);
        for (const match of raw.matchAll(/[A-Z][A-Z0-9_]{0,99}-[1-9][0-9]*/g)) {
          const offset = start + match.index!, finish = offset + match[0].length;
          let slashes = 0;
          for (let i = offset - 1; i >= 0 && source[i] === "\\"; i--) slashes++;
          const before = decodeString(source.slice(start, offset));
          const after = decodeString(source.slice(finish, end));
          if (mentions.some(mention => offset < mention.end && finish > mention.start) || slashes % 2 || boundary.test(before.at(-1) ?? source[offset - 1] ?? "") || boundary.test(after[0] ?? source[finish] ?? "")) continue;
          found.push({ identifier: match[0], start: offset, end: finish });
        }
      }
    }
    for (const child of node.children ?? []) visit(child, skip);
  }
  visit(tree);
  return found;
}
