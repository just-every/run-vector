import { fromMarkdown } from "mdast-util-from-markdown";
import { markdownMentions } from "./mention-markdown";
export function mentionedOperators(body: string): string[] {
  return [
    ...new Set(
      markdownMentions(fromMarkdown(body), body).map((mention) => mention.id),
    ),
  ];
}
