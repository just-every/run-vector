import { ImportError } from './types';

/** RFC 4180 fields, including quoted newlines. The location is the physical
 * one-based starting line, so an error still points into the original file. */
export function parseCsv(text: string, options: { repeatedHeaders?: boolean } = {}): { headers: string[]; rows: { row: number; values: string[] }[] } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: { row: number; values: string[] }[] = [];
  let values: string[] = [], value = '', quoted = false, closed = false, line = 1, start = 1;
  const field = () => { values.push(value); value = ''; closed = false; };
  const record = () => { field(); rows.push({ row: start, values }); values = []; start = line + 1; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closed = true; }
      } else { value += c; if (c === '\n') line++; else if (c === '\r' && text[i + 1] !== '\n') line++; }
      continue;
    }
    if (closed && ![',','\r','\n'].includes(c)) throw new ImportError(400,'invalid_csv',`Unexpected text after a quoted field at line ${line}.`);
    if (c === '"') {
      if (value) throw new ImportError(400,'invalid_csv',`Quote inside an unquoted field at line ${line}.`);
      quoted = true;
    } else if (c === ',') field();
    else if (c === '\r' || c === '\n') {
      record(); if (c === '\r' && text[i + 1] === '\n') i++; line++;
    } else value += c;
  }
  if (quoted) throw new ImportError(400,'invalid_csv',`Unclosed quoted field starting at line ${start}.`);
  if (value || values.length || closed) record();
  const header = rows.shift();
  if (!header || header.values.some(name => !name.trim()) || (!options.repeatedHeaders && new Set(header.values).size !== header.values.length))
    throw new ImportError(400,'invalid_headers','CSV needs nonempty, distinct headers.');
  return { headers: header.values, rows };
}
