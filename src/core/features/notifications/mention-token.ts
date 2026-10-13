/** Stable identity is explicit; a display name or email never targets an operator. */
export type Mention = { id: string; name: string };
const operatorId = /^[0-9A-HJKMNP-TV-Z]{26}$/;
function encode(value: string) {
  return encodeURIComponent(
    new TextDecoder().decode(new TextEncoder().encode(value)),
  ).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}
export function mentionToken(mention: Mention): string {
  if (
    !operatorId.test(mention.id) ||
    !mention.name ||
    mention.name.length > 200
  )
    throw new Error("Invalid mention");
  return `@{${mention.id}|${encode(mention.name)}}`;
}
export function decodeMentionToken(token: string): Mention | null {
  const match = /^@\{([0-9A-HJKMNP-TV-Z]{26})\|([^{}]*)\}$/.exec(token);
  if (!match) return null;
  try {
    const mention = { id: match[1], name: decodeURIComponent(match[2]) };
    return mentionToken(mention) === token ? mention : null;
  } catch {
    return null;
  }
}
