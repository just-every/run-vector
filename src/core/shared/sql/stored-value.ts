/** ASCII-only custody of a SQLite scalar. Text and blobs retain their exact
 * bytes and storage class, including text that is not well-formed UTF-8. */
export type StoredValue = [string, string];
export const storedValueSql = (value: string) =>
  `json_array(typeof(${value}),CASE WHEN typeof(${value}) IN ('text','blob') THEN hex(${value}) ELSE quote(${value}) END)`;

/** Reconstruct inside SQLite: a D1 scalar read decodes malformed UTF-8 and
 * cannot be rebound to recover the original text bytes. */
export function restoreValueSql(value: string) {
  const body = `json_extract(${value},'$[1]')`;
  return `CASE json_extract(${value},'$[0]') WHEN 'text' THEN CAST(unhex(${body}) AS TEXT) WHEN 'blob' THEN unhex(${body}) WHEN 'integer' THEN CAST(${body} AS INTEGER) WHEN 'real' THEN CAST(${body} AS REAL) ELSE NULL END`;
}

/** D1's string binding encodes Unicode code points, retaining an unpaired
 * UTF-16 code unit as its three-byte sequence. TextEncoder replaces it. */
export function storedText(value: string): StoredValue {
  const bytes: number[] = [];
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800)
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 63));
    else if (point < 0x10000)
      bytes.push(
        0xe0 | (point >> 12),
        0x80 | ((point >> 6) & 63),
        0x80 | (point & 63),
      );
    else
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 63),
        0x80 | ((point >> 6) & 63),
        0x80 | (point & 63),
      );
  }
  return [
    "text",
    bytes
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase(),
  ];
}
export const storedNull = (): StoredValue => ["null", "NULL"];
export const storedInteger = (value: number): StoredValue => [
  "integer",
  String(value),
];
export const isStoredNull = (value: StoredValue) => value[0] === "null";
export function storedRow(
  row: Record<string, string | null>,
): Record<string, StoredValue> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value === null ? storedNull() : storedText(value),
    ]),
  );
}
