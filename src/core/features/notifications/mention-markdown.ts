import { decodeString } from "micromark-util-decode-string";
import { decodeMentionToken, type Mention } from "./mention-token.ts";
/** Structural subset shared with remark; no parser, storage, or transport imports. */
export type MentionNode = {
  type: string;
  value?: string;
  children?: MentionNode[];
  // mdast metadata interfaces are extensible objects, without an index signature.
  data?: object;
  position?: { start: { offset?: number }; end: { offset?: number } };
};
export type MentionSpan = Mention & { start: number; end: number };
export function markdownMentions(
  tree: MentionNode,
  source: string,
): MentionSpan[] {
  const found: MentionSpan[] = [];
  // A quoted mailbox local part can contain spaces, punctuation, and several
  // otherwise valid tokens. Exclude the whole mailbox, while ordinary quoted
  // prose remains eligible. Quoted pairs keep an escaped quote inside the local
  // part rather than incorrectly treating it as its closing delimiter.
  const mailboxes = [
    ...source.matchAll(
      /"(?:[^"\\\r\n]|\\[^\r\n])*"@(?:\[[^\]\r\n]+\]|[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?)/gu,
    ),
  ].map((match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
  }));
  // Inline HTML is separate from its inner text in CommonMark. Conservatively
  // suppress text until the matching closing tag, including malformed open tags.
  const html: string[] = [];
  function visit(node: MentionNode, excluded = false) {
    if (node.type === "html") {
      for (const tag of (node.value ?? "").matchAll(
        /<\s*(\/?)\s*([A-Za-z][\w:-]*)\b[^>]*>/g,
      )) {
        const name = tag[2].toLowerCase();
        if (tag[1]) {
          const at = html.lastIndexOf(name);
          if (at >= 0) html.splice(at);
        } else if (
          !/\/\s*>$/.test(tag[0]) &&
          ![
            "br",
            "hr",
            "img",
            "input",
            "meta",
            "link",
            "wbr",
            "source",
            "area",
            "base",
            "col",
            "embed",
            "param",
            "track",
          ].includes(name)
        )
          html.push(name);
      }
      return;
    }
    const skip =
      excluded ||
      [
        "link",
        "linkReference",
        "image",
        "imageReference",
        "code",
        "inlineCode",
        "definition",
      ].includes(node.type);
    if (node.type === "text" && !skip && html.length === 0) {
      const start = node.position?.start.offset,
        end = node.position?.end.offset;
      if (start === undefined || end === undefined) return;
      const raw = source.slice(start, end);
      // Decoded escapes/entities cannot manufacture a token. Offset alignment
      // remains exact even when earlier content in this text node was escaped.
      for (const match of raw.matchAll(
        /@\{[0-9A-HJKMNP-TV-Z]{26}\|[^{}\r\n]*\}/g,
      )) {
        const offset = start + match.index!,
          finish = offset + match[0].length;
        let slashes = 0;
        for (let i = offset - 1; i >= 0 && source[i] === "\\"; i--) slashes++;
        if (
          slashes % 2 ||
          mailboxes.some(
            (mailbox) => offset >= mailbox.start && finish <= mailbox.end,
          ) ||
          /[\p{L}\p{N}_@.+-]/u.test(source[offset - 1] ?? "") ||
          /[\p{L}\p{N}_@+-]/u.test(source[finish] ?? "") ||
          /^\.[\p{L}\p{N}]/u.test(source.slice(finish))
        )
          continue;
        const mention = decodeMentionToken(match[0]);
        if (mention) found.push({ ...mention, start: offset, end: finish });
      }
    }
    for (const child of node.children ?? []) visit(child, skip);
  }
  visit(tree);
  return found;
}
/** remark plugin: mutate text nodes only after the CommonMark parse. */
export function remarkMentions(
  options: { operatorIds?: readonly string[] } = {},
) {
  return (tree: MentionNode, file: { value: unknown }) => {
    const source = String(file.value),
      spans = markdownMentions(tree, source).filter((span) =>
        options.operatorIds?.includes(span.id),
      );
    function visit(node: MentionNode) {
      if (node.type === "text" && node.value !== undefined) {
        const start = node.position?.start.offset,
          end = node.position?.end.offset;
        if (start !== undefined && end !== undefined) {
          const original = node.value;
          const replacements = spans
            .filter((s) => s.start >= start && s.end <= end)
            .map((span) => {
              const token = source.slice(span.start, span.end);
              // CommonMark decodes escapes and entities in a text node. Count
              // decoded occurrences before this exact source span so an escaped
              // or entity-created identical token cannot steal its replacement.
              const preceding =
                decodeString(source.slice(start, span.start)).split(token)
                  .length - 1;
              let at = -1;
              for (let n = 0; n <= preceding; n++)
                at = original.indexOf(token, at + 1);
              return { at, token, label: "@" + span.name, start: span.start, end: span.end };
            })
            .filter((replacement) => replacement.at >= 0)
            .sort((a, b) => a.at - b.at);
          if (replacements.length) {
            const children = [];
            let cursor = 0, rawCursor = start;
            node.value = "";
            for (const replacement of replacements) {
              const before = original.slice(cursor, replacement.at);
              children.push(
                { type: "text", value: before, position: { start: { offset: rawCursor }, end: { offset: replacement.start } } },
                {
                  type: "element",
                  tagName: "span",
                  properties: { className: ["mention-chip"] },
                  position: { start: { offset: replacement.start }, end: { offset: replacement.end } },
                  children: [{ type: "text", value: replacement.label }],
                },
              );
              node.value += before + replacement.label;
              cursor = replacement.at + replacement.token.length;
              rawCursor = replacement.end;
            }
            const after = original.slice(cursor);
            children.push({ type: "text", value: after, position: { start: { offset: rawCursor }, end: { offset: end } } });
            node.value += after;
            // Preserve the readable mdast value for text consumers. Only these
            // validated source spans receive element metadata; labels stay
            // HAST text, never raw HTML or another Markdown parse.
            node.data = { ...node.data, hName: "span", hChildren: children };
          }
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
