/** Every table that still holds one of the needles (lower-case), with a count of
 * holding values. Reads every column of every table, virtual and shadow tables
 * included: text as stored, BLOBs and hex/base64 text decoded as UTF-8, and each
 * table's values joined in row order so a value split across chunks is found.
 * Then every object in the bucket. */
export async function holders(db: D1Database, needles: string[], bucket?: R2Bucket) {
  const decoder = new TextDecoder(), found: Record<string, number> = {};
  const decode = (value: unknown): string[] => {
    if (typeof value === 'string') {
      const texts = [value];
      if (value.length >= 32 && value.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(value)) texts.push(decoder.decode(Uint8Array.from(value.match(/../g)!.map(pair => parseInt(pair, 16)))));
      if (value.length >= 24 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) texts.push(decoder.decode(Uint8Array.from(atob(value), char => char.charCodeAt(0))));
      return texts;
    }
    if (value instanceof ArrayBuffer) return [decoder.decode(value)];
    if (Array.isArray(value) && value.every(byte => typeof byte === 'number')) return [decoder.decode(Uint8Array.from(value as number[]))];
    return [];
  };
  const holds = (texts: string[]) => texts.some(text => { const lower = text.toLowerCase(); return needles.some(needle => lower.includes(needle)); });
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>()).results;
  for (const { name } of tables) {
    let joined = '', count = 0;
    for (let offset = 0; ; offset += 500) {
      const rows = (await db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" LIMIT 500 OFFSET ?`).bind(offset).all<Record<string, unknown>>()).results;
      for (const row of rows) for (const value of Object.values(row)) {
        const texts = decode(value);
        if (holds(texts)) count++;
        joined += texts.join('');
      }
      if (rows.length < 500) break;
    }
    if (!count && holds([joined])) count = 1;
    if (count) found[name] = count;
  }
  let cursor: string | undefined;
  if (bucket) do {
    const listed = await bucket.list({ cursor });
    for (const object of listed.objects) if (holds([decoder.decode(await (await bucket.get(object.key))!.arrayBuffer())])) found['r2:' + object.key] = 1;
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return found;
}
