export type TextEdit = { start: number; end: number; text: string };
export type Selection = { start: number; end: number };
export type MarkdownChange = { edits: TextEdit[]; selection: Selection };
export type Command = { id: string; label: string; keywords?: string };
export const commands: Command[] = [
  { id: "h1", label: "Heading 1" },
  { id: "h2", label: "Heading 2" },
  { id: "h3", label: "Heading 3" },
  { id: "bold", label: "Bold" },
  { id: "italic", label: "Italic" },
  { id: "strike", label: "Strikethrough" },
  { id: "inline-code", label: "Inline code" },
  { id: "link", label: "Link" },
  { id: "issue", label: "Issue link" },
  { id: "mention", label: "Mention an operator" },
  { id: "bullet", label: "Bulleted list" },
  { id: "number", label: "Numbered list" },
  { id: "check", label: "Checklist", keywords: "task todo" },
  { id: "quote", label: "Quote" },
  { id: "divider", label: "Divider", keywords: "horizontal rule" },
  { id: "table", label: "Table" },
  { id: "code", label: "Code block", keywords: "language" },
  { id: "details", label: "Collapsible section", keywords: "toggle details" },
];
export const languages = [
  "text",
  "javascript",
  "typescript",
  "python",
  "json",
  "bash",
  "html",
  "css",
  "sql",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "ruby",
  "php",
  "csharp",
  "diff",
  "shell",
  "sh",
  "c",
  "cpp",
  "yaml",
  "markdown",
];

export function slashQuery(text: string, caret: number) {
  const start = text.lastIndexOf("\n", caret - 1) + 1;
  const match = /^[ \t]*\/([\w -]*)$/.exec(text.slice(start, caret));
  return match
    ? { start: start + match[0].indexOf("/"), end: caret, query: match[1] }
    : null;
}

function wrap(
  text: string,
  range: Selection,
  open: string,
  close = open,
): MarkdownChange {
  const { start, end } = range;
  if (
    start >= open.length &&
    text.slice(start - open.length, start) === open &&
    text.slice(end, end + close.length) === close
  )
    return {
      edits: [
        { start: end, end: end + close.length, text: "" },
        { start: start - open.length, end: start, text: "" },
      ],
      selection: { start: start - open.length, end: end - open.length },
    };
  return {
    edits: [
      { start: end, end, text: close },
      { start, end: start, text: open },
    ],
    selection: { start: start + open.length, end: end + open.length },
  };
}

/** Small edits retain mention ranges inside formatted selections. */
export function markdownCommand(
  id: string,
  text: string,
  range: Selection,
  language = "text",
): MarkdownChange {
  if (id === "bold") return wrap(text, range, "**");
  if (id === "italic") return wrap(text, range, "_");
  if (id === "strike") return wrap(text, range, "~~");
  if (id === "inline-code") {
    const longest = Math.max(
      0,
      ...Array.from(
        text.slice(range.start, range.end).matchAll(/`+/g),
        (m) => m[0].length,
      ),
    );
    const fence = "`".repeat(longest + 1);
    return wrap(
      text,
      range,
      fence + (longest ? " " : ""),
      (longest ? " " : "") + fence,
    );
  }
  if (["h1", "h2", "h3", "bullet", "number", "check", "quote"].includes(id)) {
    const start = text.lastIndexOf("\n", range.start - 1) + 1;
    const end = text.indexOf("\n", Math.max(range.start, range.end - 1));
    const lines = text.slice(start, end < 0 ? text.length : end).split("\n");
    const prefixes = lines.map((_, index) =>
      id === "quote"
        ? "> "
        : id === "bullet"
          ? "- "
          : id === "number"
            ? `${index + 1}. `
            : id === "check"
              ? "- [ ] "
              : "#".repeat(Number(id.slice(1))) + " ",
    );
    const existing = lines.map(
      (line) =>
        /^(?:#{1,6} |>[ \t]?|(?:[-+*]|\d+\.) (?:\[[ xX]\] )?)/.exec(
          line,
        )?.[0] ?? "",
    );
    const remove = existing.every(
      (prefix, index) => prefix === prefixes[index],
    );
    let offset = start;
    const edits = lines.map((line, index) => {
      const edit = {
        start: offset,
        end: offset + existing[index].length,
        text: remove ? "" : prefixes[index],
      };
      offset += line.length + 1;
      return edit;
    });
    const shift = edits.reduce(
      (total, edit) => total + edit.text.length - (edit.end - edit.start),
      0,
    );
    return {
      edits: edits.reverse(),
      selection: {
        start: Math.max(
          start,
          range.start +
            edits[edits.length - 1].text.length -
            existing[0].length,
        ),
        end: Math.max(start, range.end + shift),
      },
    };
  }
  let open = "",
    close = "",
    content = "";
  if (id === "code") {
    const longest = Math.max(
      2,
      ...Array.from(
        text.slice(range.start, range.end).matchAll(/`+/g),
        (m) => m[0].length,
      ),
    );
    open = `${"`".repeat(longest + 1)}${language === "text" ? "" : language}\n`;
    close = `\n${"`".repeat(longest + 1)}`;
  } else if (id === "details") {
    open = ":::details Summary\n\n";
    close = "\n\n:::";
  } else if (id === "divider") content = "---";
  else if (id === "table")
    content = "| Column 1 | Column 2 |\n| --- | --- |\n|  |  |";
  else throw new Error(`Unknown Markdown command: ${id}`);
  const before = text.slice(0, range.start);
  const after = text.slice(range.end);
  const leading = before
    ? before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n"
    : "";
  const trailing = after
    ? after.startsWith("\n\n")
      ? ""
      : after.startsWith("\n")
        ? "\n"
        : "\n\n"
    : "\n";
  if (content)
    return {
      edits: [{ ...range, text: leading + content + trailing }],
      selection: {
        start: range.start + leading.length + content.length,
        end: range.start + leading.length + content.length,
      },
    };
  const change = wrap(text, range, leading + open, close + trailing);
  return change;
}

export function linkCommand(
  range: Selection,
  label: string,
  href: string,
): MarkdownChange {
  return range.start === range.end
    ? {
        edits: [{ ...range, text: `[${label}](${href})` }],
        selection: {
          start: range.start + 1,
          end: range.start + label.length + 1,
        },
      }
    : {
        edits: [
          { start: range.end, end: range.end, text: `](${href})` },
          { start: range.start, end: range.start, text: "[" },
        ],
        selection: { start: range.start + 1, end: range.end + 1 },
      };
}
