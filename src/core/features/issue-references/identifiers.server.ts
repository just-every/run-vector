import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { markdownIssueReferences } from "./markdown";

export function extractIssueIdentifiers(body: string): string[] {
  const tree = fromMarkdown(body, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  return [...new Set(markdownIssueReferences(tree, body).map(span => span.identifier))];
}
