import {
  decodeMentionToken,
  mentionToken,
  type Mention,
} from "../mention-token.ts";
export type EditorMention = { start: number; end: number; token: string };
export type MentionEditorState = { text: string; mentions: EditorMention[] };
/** Presentation ranges preserve the exact selected identity, including name collisions. */
export function projectMentionBody(
  body: string,
  operatorIds: readonly string[] = [],
): MentionEditorState {
  let text = "",
    offset = 0;
  const mentions: EditorMention[] = [];
  for (const match of body.matchAll(
    /@\{[0-9A-HJKMNP-TV-Z]{26}\|[^{}\r\n]*\}/g,
  )) {
    const mention = decodeMentionToken(match[0]);
    if (!mention || !operatorIds.includes(mention.id)) continue;
    text += body.slice(offset, match.index);
    const start = text.length;
    text += "@" + mention.name;
    mentions.push({ start, end: text.length, token: match[0] });
    offset = match.index! + match[0].length;
  }
  return { text: text + body.slice(offset), mentions };
}
export function canonicalMentionBody(state: MentionEditorState): string {
  let body = "",
    offset = 0;
  for (const mention of state.mentions) {
    body += state.text.slice(offset, mention.start) + mention.token;
    offset = mention.end;
  }
  return body + state.text.slice(offset);
}
/** Editing a mention's readable name deliberately converts that occurrence to literal text. */
export function editMentionText(
  state: MentionEditorState,
  text: string,
  edit?: { start: number; end: number; inputType: string },
): MentionEditorState {
  let start = 0;
  while (
    start < state.text.length &&
    start < text.length &&
    state.text[start] === text[start]
  )
    start++;
  let end = state.text.length,
    nextEnd = text.length;
  while (
    end > start &&
    nextEnd > start &&
    state.text[end - 1] === text[nextEnd - 1]
  ) {
    end--;
    nextEnd--;
  }
  if (edit) {
    let from = edit.start,
      to = edit.end;
    const removed = state.text.length - text.length;
    if (from === to && removed > 0 && edit.inputType.startsWith("delete")) {
      if (edit.inputType.endsWith("Backward"))
        from = Math.max(0, from - removed);
      else to = Math.min(state.text.length, to + removed);
    }
    const finish = from + text.length - (state.text.length - (to - from));
    if (
      finish >= from &&
      text.slice(0, from) === state.text.slice(0, from) &&
      text.slice(finish) === state.text.slice(to)
    ) {
      start = from;
      end = to;
      nextEnd = finish;
    }
  }
  const shift = nextEnd - end;
  return {
    text,
    mentions: state.mentions.flatMap((mention) => {
      if (mention.end <= start) return [mention];
      if (
        mention.start >= end &&
        !(start === end && start > mention.start && start < mention.end)
      )
        return [
          {
            ...mention,
            start: mention.start + shift,
            end: mention.end + shift,
          },
        ];
      return [];
    }),
  };
}
export function selectEditorMention(
  state: MentionEditorState,
  start: number,
  end: number,
  mention: Mention,
): MentionEditorState {
  const label = "@" + mention.name;
  const text = state.text.slice(0, start) + label + " " + state.text.slice(end);
  const shift = label.length + 1 - (end - start);
  const mentions = state.mentions.flatMap((span) =>
    span.end <= start
      ? [span]
      : span.start >= end
        ? [{ ...span, start: span.start + shift, end: span.end + shift }]
        : [],
  );
  mentions.push({
    start,
    end: start + label.length,
    token: mentionToken(mention),
  });
  return { text, mentions: mentions.sort((a, b) => a.start - b.start) };
}
export function mentionQuery(
  text: string,
  caret: number,
): { start: number; end: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(?:^|[\s([\]])@([^@\s{}\n]{0,200})$/.exec(before);
  if (!match) return null;
  return { start: caret - match[1].length - 1, end: caret, query: match[1] };
}
/** Keep a caret anchored to the same body position when active identities change. */
export function reprojectMentionCaret(
  previous: MentionEditorState,
  next: MentionEditorState,
  caret: number,
): number {
  if (previous.text === next.text) return Math.min(caret, next.text.length);
  let bodyPosition = caret,
    shift = 0;
  for (const span of previous.mentions) {
    if (caret <= span.start) break;
    if (caret < span.end) {
      bodyPosition = span.start + shift + span.token.length;
      break;
    }
    shift += span.token.length - (span.end - span.start);
    bodyPosition = caret + shift;
  }
  shift = 0;
  for (const span of next.mentions) {
    const start = span.start + shift,
      end = start + span.token.length;
    if (bodyPosition <= start) break;
    if (bodyPosition < end) return span.end;
    shift += span.token.length - (span.end - span.start);
  }
  return Math.min(next.text.length, bodyPosition - shift);
}
