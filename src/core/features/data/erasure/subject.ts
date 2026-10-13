import { z } from 'zod';
import type { Json, SourceRecord } from '../../../../../vendor/base/import-kit/src/d1/index';

/** The person as imports carried them: an exact email and/or the exact display
 * names Linear or a mapped file gave them. Matching is exact and case-insensitive,
 * never a substring of a cell. */
export const erasureSubjectSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  names: z.array(z.string().trim().min(2).max(200)).max(5).default([]),
}).strict().refine(subject => Boolean(subject.email) || subject.names.length > 0, { message: 'subject_required' });
export type ErasureSubject = z.infer<typeof erasureSubjectSchema>;

/** What the owner types to confirm: `erase` and the email, or the first name. */
export const confirmationFor = (subject: ErasureSubject) => 'erase ' + (subject.email ?? subject.names[0]);

/** Every value that identifies the person, lower-cased and de-duplicated. */
export function personValues(subject: ErasureSubject, extraNames: string[] = []) {
  return [...new Set([subject.email, ...subject.names, ...extraNames].filter((value): value is string => Boolean(value)).map(value => value.trim().toLowerCase()))].sort();
}

/** import-kit `related` matchers. A retained record matches when any string in
 * its payload equals a value; an original matches when its text holds one. The
 * matchers read decoded personal data and keep nothing. */
export function relatedMatchers(values: string[]) {
  const wanted = new Set(values);
  const holds = (value: Json | undefined): boolean => typeof value === 'string' ? wanted.has(value.trim().toLowerCase())
    : Array.isArray(value) ? value.some(holds)
    : value !== null && typeof value === 'object' ? Object.values(value).some(holds) : false;
  const decoder = new TextDecoder();
  return {
    source: (record: SourceRecord) => holds(record.payload),
    original: (bytes: Uint8Array) => { const text = decoder.decode(bytes).toLowerCase(); return values.some(value => text.includes(value)); },
  };
}

/** Replaces every string equal to a value with an empty string, and reports whether any did. */
export function scrubJson(value: Json, values: Set<string>): { value: Json; changed: boolean } {
  if (typeof value === 'string') return values.has(value.trim().toLowerCase()) ? { value: '', changed: true } : { value, changed: false };
  if (Array.isArray(value)) { const items = value.map(item => scrubJson(item, values)); return { value: items.map(item => item.value), changed: items.some(item => item.changed) }; }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [key, scrubJson(item, values)] as const);
    return { value: Object.fromEntries(entries.map(([key, item]) => [key, item.value])), changed: entries.some(([, item]) => item.changed) };
  }
  return { value, changed: false };
}
