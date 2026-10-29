import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

export type MarkdownTask = {
  index: number;
  text: string;
  checked: boolean;
  start: number;
  end: number;
};

/** Parse the same GFM list items the renderer accepts, including nested lists. */
export function parseTasks(source: string): MarkdownTask[] {
  const tree = fromMarkdown(source, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const tasks: MarkdownTask[] = [];
  type Node = { type: string; checked?: boolean | null; position?: { start: { offset?: number }; end: { offset?: number } }; children?: Node[] };
  function visit(node: Node) {
    if (node.type === "listItem" && typeof node.checked === "boolean") {
      const start = node.position?.start.offset, end = node.position?.end.offset;
      if (start === undefined || end === undefined)
        throw new Error("Task source position is missing.");
      const raw = source.slice(start, end);
      const prefix = /^(?:[*+-]|\d+[.)])[\t ]+\[[ xX]\](?:[\t ]+|$)/.exec(raw);
      if (!prefix) throw new Error("Task source marker is missing.");
      tasks.push({ index: tasks.length, text: raw.slice(prefix[0].length), checked: node.checked, start, end });
    }
    if (node.children) for (const child of node.children) visit(child);
  }
  visit(tree);
  return tasks;
}

/** Exact source comparison prevents a delayed click from editing another item. */
export function toggleTask(source: string, index: number, text: string, checked: boolean): string | null {
  const task = parseTasks(source)[index];
  if (!task || task.text !== text) return null;
  if (task.checked === checked) return source;
  const marker = /^(?:[*+-]|\d+[.)])[\t ]+\[/.exec(source.slice(task.start, task.end));
  if (!marker) throw new Error("Task source marker is missing.");
  const offset = task.start + marker[0].length;
  return source.slice(0, offset) + (checked ? "x" : " ") + source.slice(offset + 1);
}

/** A parent's source includes its nested items, whose ticks are independent. */
function unchangedText(source: string, tasks: MarkdownTask[], parent: MarkdownTask): string {
  const text = parent.text.split("");
  const start = parent.end - parent.text.length;
  for (const child of tasks) {
    if (child.start <= parent.start || child.end > parent.end) continue;
    const marker = /^(?:[*+-]|\d+[.)])[\t ]+\[/.exec(source.slice(child.start, child.end));
    if (!marker) throw new Error("Task source marker is missing.");
    const offset = child.start + marker[0].length - start;
    text[offset] = " ";
  }
  return text.join("");
}

/** A stale click may change only the task the caller actually read. */
export function mergeTask(source: string, expectedSource: string, index: number, text: string, checked: boolean): string | null {
  const expectedTasks = parseTasks(expectedSource), tasks = parseTasks(source);
  const expected = expectedTasks[index], current = tasks[index];
  if (!expected || !current || expected.text !== text ||
      unchangedText(source, tasks, current) !== unchangedText(expectedSource, expectedTasks, expected)) return null;
  return toggleTask(source, index, current.text, checked);
}
