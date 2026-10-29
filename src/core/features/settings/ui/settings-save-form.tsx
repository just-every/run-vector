import { startTransition, useEffect, useRef, useState, type FormHTMLAttributes } from 'react';
import { useRouteContext } from '@tanstack/react-router';
import type { z } from 'zod';
import { ApiError, fetchJson } from '../../../app/api-client';
import { useHydrated } from '../../../app/initial-resources';
import { SettingsSaveFeedback, withSettingsLabels, saveField, type SaveState, type SaveField, type SaveFailure } from './settings-save-feedback';

type Fields = [string, string][];
/** `bases` are the server values the draft was edited from: the form at its first
 * edit, and a write of this form still in flight when it was edited. */
type Draft = { revision: string; bases: Fields[]; fields: Fields; valid: boolean; confirmed: boolean; field?: SaveField };
const writes = new Map<string, { revision: string; request: Promise<unknown> }>();
function isFields(value: unknown): value is Fields {
  return Array.isArray(value) && value.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(part => typeof part === 'string'));
}
function formFields(form: HTMLFormElement): Fields {
  return Array.from(new FormData(form)).filter((pair): pair is [string, string] => typeof pair[1] === 'string');
}
const sameFields = (left: Fields, right: Fields) => JSON.stringify(left) === JSON.stringify(right);
function readDraft(key: string): Draft | null {
  const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
  if (!value || typeof value !== 'object') return null;
  const draft = value as Draft;
  if (draft.field && (typeof draft.field.name !== 'string' || typeof draft.field.id !== 'string' || (draft.field.choice !== undefined && typeof draft.field.choice !== 'string'))) return null;
  return typeof draft.revision === 'string' && typeof draft.confirmed === 'boolean' && typeof draft.valid === 'boolean'
    && Array.isArray(draft.bases) && draft.bases.every(isFields) && isFields(draft.fields) ? draft : null;
}
function restore(form: HTMLFormElement, draft: Draft) {
  const fields = new FormData();
  for (const [name, value] of draft.fields) fields.append(name, value);
  for (const field of Array.from(form.elements)) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) || !field.name) continue;
    if (field instanceof HTMLInputElement && ['password', 'file'].includes(field.type)) continue;
    if (field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type)) field.checked = fields.getAll(field.name).includes(field.value);
    else field.value = String(fields.get(field.name) ?? '');
  }
}
function invalidField(form: HTMLFormElement) {
  for (const field of Array.from(form.elements)) {
    if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) && !field.validity.valid) return field;
  }
}

type Props<S extends z.ZodType> = Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'onChange'> & {
  path: string; method?: string; schema: S; read: (fields: FormData) => unknown;
  onSaved?: (receipt: z.output<S>) => void; confirm?: string; identity?: string; initialize?: (form: HTMLFormElement) => boolean; onRestored?: (fields: FormData) => void;
};

/** Keep the actual field draft until the server acknowledges that revision.
 * It is stored synchronously on edit, so navigation and even an offline tab
 * close cannot discard it. A kept draft is sent again only while the server
 * still holds a value it was edited from, so it never writes over a newer
 * value. Only non-secret settings belong in this form. */
export function SettingsSaveForm<S extends z.ZodType>({ path, method = 'PUT', schema, read, onSaved, confirm, identity, initialize, onRestored, children, ...props }: Props<S>) {
  const { operator } = useRouteContext({ from: '/app' });
  const hydrated = useHydrated();
  const key = `vector:settings-draft:${operator.id}:${identity ?? path}`;
  const form = useRef<HTMLFormElement>(null), draft = useRef<Draft | null>(null);
  // The server values this form shows, the values of the write in flight, and the setting already restored.
  const base = useRef<Fields>([]), sending = useRef<Fields | null>(null), restored = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false), mounted = useRef(false);
  const current = useRef({ path, method, schema, read, onSaved });
  current.current = { path, method, schema, read, onSaved };
  const [state, setState] = useState<SaveState>('idle');
  const [field, setField] = useState<SaveField | null>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  function status(next: typeof state) { if (mounted.current) setState(next); }
  async function flush() {
    clearTimeout(timer.current);
    const snapshot = draft.current;
    if (!snapshot || busy.current || !snapshot.valid || (confirm && !snapshot.confirmed)) return;
    const fields = new FormData();
    for (const [name, value] of snapshot.fields) fields.append(name, value);
    const options = current.current, body = options.read(fields);
    busy.current = true; sending.current = snapshot.fields; setFailure(null); status('saving');
    // A remount may join a still-running write. Serialize per setting so an
    // earlier receipt can never overtake a later edit in this document.
    const previous = writes.get(key);
    const request = previous?.revision === snapshot.revision ? previous.request : (previous?.request ?? Promise.resolve()).catch(() => {}).then(() => fetchJson(options.path, options.schema, {
      method: options.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true,
    }));
    writes.set(key, { revision: snapshot.revision, request });
    try {
      const receipt = await request as z.output<S>;
      base.current = snapshot.fields;
      if (draft.current?.revision === snapshot.revision) {
        draft.current = null;
        try { if (readDraft(key)?.revision === snapshot.revision) localStorage.removeItem(key); } catch { /* The in-memory draft is still acknowledged. */ }
        status('saved');
      } else if (draft.current) {
        // An edit made during this write now starts from the value it saved.
        const later = draft.current;
        later.bases = [snapshot.fields];
        try { if (readDraft(key)?.revision === later.revision) localStorage.setItem(key, JSON.stringify(later)); } catch { /* Keep the new base in memory. */ }
      }
      // "Saved" renders first; what the save changes elsewhere on the page follows it.
      startTransition(() => options.onSaved?.(receipt));
    } catch (cause) {
      if (draft.current?.revision === snapshot.revision && mounted.current) {
        const body = cause instanceof ApiError ? cause.body : null;
        const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : 'Couldn’t save.';
        setFailure({ message, retryable: cause instanceof TypeError }); status('failed');
      }
      // A failed request may be retried; an acknowledged revision keeps its
      // receipt so a remount joining that revision cannot send it twice.
      if (writes.get(key)?.request === request) writes.delete(key);
    }
    finally {
      busy.current = false; sending.current = null;
      if (draft.current && draft.current.revision !== snapshot.revision) schedule();
    }
  }
  function schedule() {
    clearTimeout(timer.current);
    if (!confirm || draft.current?.confirmed) timer.current = setTimeout(() => void flush(), 600);
  }
  function edit(target?: EventTarget | null) {
    const element = form.current;
    if (!element) return;
    const invalid = invalidField(element);
    const changed = invalid ?? target ?? element.querySelector('[name]');
    const editedField = changed instanceof HTMLInputElement || changed instanceof HTMLSelectElement || changed instanceof HTMLTextAreaElement ? saveField(changed) : undefined;
    if (editedField) setField(editedField);
    const bases = draft.current ? [...draft.current.bases] : [base.current];
    // A write still in flight may land after this document closes.
    const inFlight = sending.current;
    if (inFlight && !bases.some(server => sameFields(server, inFlight))) bases.push(inFlight);
    draft.current = { revision: crypto.randomUUID(), bases, fields: formFields(element), valid:!invalid, confirmed: false, field: editedField };
    try { localStorage.setItem(key, JSON.stringify(draft.current)); } catch { /* Keep the draft in this mounted form if device storage is unavailable. */ }
    setFailure(invalid ? { message: invalid.validationMessage, retryable: false } : null);
    status(invalid ? 'failed' : 'dirty'); schedule();
  }
  useEffect(() => {
    if (hydrated && form.current && !draft.current) base.current = formFields(form.current);
  });
  useEffect(() => {
    if (!hydrated) return;
    mounted.current = true;
    // Development remounts run this effect twice on one form; restore once.
    if (form.current && restored.current !== key) {
      restored.current = key;
      const first = form.current.querySelector('[name]');
      if (first instanceof HTMLInputElement || first instanceof HTMLSelectElement || first instanceof HTMLTextAreaElement) setField(saveField(first));
      base.current = formFields(form.current);
      try {
        const saved = readDraft(key);
        // A departure write can land without its receipt reaching the closing
        // document, and another device can save after it. Either way the
        // server no longer holds this draft's base, and its value wins.
        if (saved && saved.bases.some(server => sameFields(server, base.current))) {
          draft.current = saved; restore(form.current, saved);
          const invalid = invalidField(form.current);
          saved.valid = !invalid;
          if (invalid) setField(saveField(invalid)); else if (saved.field) setField(saved.field);
          setFailure(invalid ? { message: invalid.validationMessage, retryable: false } : null);
          onRestored?.(new FormData(form.current)); status(invalid ? 'failed' : 'dirty');
          if (writes.get(key)?.revision === saved.revision) void flush(); else schedule();
        } else {
          localStorage.removeItem(key);
          if (initialize?.(form.current)) edit();
        }
      } catch { /* An unreadable device draft cannot replace current server values. */ }
    }
    const leave = () => { if (!confirm) void flush(); };
    window.addEventListener('beforeunload', leave);
    window.addEventListener('pagehide', leave);
    return () => { leave(); mounted.current = false; clearTimeout(timer.current); window.removeEventListener('beforeunload', leave); window.removeEventListener('pagehide', leave); };
  }, [key, hydrated]);
  return <SettingsSaveFeedback.Provider value={{state, field, failure, retry: () => void flush(), ready: hydrated}}><form {...props} ref={form} onChange={event => edit(event.target)} onSubmit={event => {
    event.preventDefault();
    if (draft.current && confirm) {
      draft.current.confirmed = true;
      try { localStorage.setItem(key, JSON.stringify(draft.current)); } catch { /* Retain the in-memory confirmation. */ }
    }
    void flush();
  }}>
    {withSettingsLabels(children, hydrated)}
    {confirm && state === 'dirty' && <button type="submit">{confirm}</button>}
    {(state === 'saving' || state === 'saved') && <span className="settings-save-announcement" role="status" aria-label="Save status">{state === 'saved' ? 'Saved' : 'Saving…'}</span>}
  </form></SettingsSaveFeedback.Provider>;
}
