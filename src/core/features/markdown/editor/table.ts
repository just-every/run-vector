import type { MarkdownChange, Selection, TextEdit } from "./commands";
export type TableAction = "row" | "column" | "remove-row" | "remove-column";

/** Operates only on an actual GFM table around the caret; escaped pipes stay cells. */
export function selectedTable(text: string, range: Selection) {
  let start = text.lastIndexOf("\n", range.start - 1) + 1;
  let end = text.indexOf("\n", range.end);
  if (end < 0) end = text.length;
  const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
  while (start > 0) {
    const previous = text.lastIndexOf("\n", start - 2) + 1;
    if (!isRow(text.slice(previous, start - 1))) break;
    start = previous;
  }
  while (end < text.length) {
    const next = text.indexOf("\n", end + 1);
    if (!isRow(text.slice(end + 1, next < 0 ? text.length : next))) break;
    end = next < 0 ? text.length : next;
  }
  const lines = text.slice(start, end).split("\n");
  if (
    lines.length < 2 ||
    !lines.every(isRow) ||
    !/^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[1])
  )
    return null;
  const boundaries = (line: string) =>
    Array.from(
      line.matchAll(/(?<!\\)(?:\\\\)*\|/g),
      (match) => match.index! + match[0].length - 1,
    );
  const pipes = lines.map(boundaries);
  const columns = pipes[0].length - 1;
  if (!columns || pipes.some((row) => row.length !== columns + 1)) return null;
  const row = text.slice(start, range.start).split("\n").length - 1;
  const lineStart =
    start + lines.slice(0, row).reduce((n, line) => n + line.length + 1, 0);
  const column = Math.max(
    0,
    Math.min(
      columns - 1,
      pipes[row].filter((pipe) => pipe < range.start - lineStart).length - 1,
    ),
  );
  return { start, end, lines, pipes, columns, row, column };
}
export function tableChange(
  text: string,
  range: Selection,
  action: TableAction,
): MarkdownChange | null {
  const table = selectedTable(text, range);
  if (!table) return null;
  const { start, end, lines, pipes, columns, row, column } = table;
  let edits: TextEdit[];
  if (action === "row") {
    const position =
      row < 2
        ? start + lines[0].length + 1 + lines[1].length
        : start + lines.slice(0, row + 1).join("\n").length;
    const content = "\n|" + "  |".repeat(columns);
    edits = [{ start: position, end: position, text: content }];
    return { edits, selection: { start: position + 3, end: position + 3 } };
  }
  if (action === "remove-row") {
    if (row < 2) return null;
    const position =
      start + lines.slice(0, row).reduce((n, line) => n + line.length + 1, 0);
    edits = [
      { start: position - 1, end: position + lines[row].length, text: "" },
    ];
  } else {
    if (action === "remove-column" && columns <= 1) return null;
    let offset = start;
    edits = lines
      .map((line, index) => {
        const left = pipes[index][column],
          right = pipes[index][column + 1];
        const edit =
          action === "column"
            ? {
                start: offset + right,
                end: offset + right,
                text: index === 1 ? "| --- " : "|  ",
              }
            : { start: offset + left, end: offset + right, text: "" };
        offset += line.length + 1;
        return edit;
      })
      .reverse();
  }
  return { edits, selection: { start, end: Math.min(start, end) } };
}
