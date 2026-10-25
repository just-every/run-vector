import { useEffect, useRef, useState, type FormHTMLAttributes } from 'react';
import { useRouteContext } from '@tanstack/react-router';
import type { z } from 'zod';
import { fetchJson } from '../../../app/api-client';
import { useHydrated } from '../../../app/initial-resources';
import { SettingsSaveFeedback, withSettingsLabels, saveField, type SaveState, type SaveField } from './settings-save-feedback';

type Draft = { revision: string; fields: [string, string][]; valid: boolean; confirmed: boolean; field?: SaveField };
const writes = new Map<string, Promise<unknown>>();
function readDraft(key: string): Draft | null {
  const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
  if (!value || typeof value !== 'object') return null;
  const draft = value as Draft;
  if (draft.field && (typeof draft.field.name !== 'string' || typeof draft.field.id !== 'string' || (draft.field.choice !== undefined && typeof draft.field.choice !== 'string'))) return null;
  return typeof draft.revision === 'string' && typeof draft.confirmed === 'boolean' && typeof draft.valid === 'boolean' && Array.isArray(draft.fields)
    && draft.fields.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(value => typeof value === 'string')) ? draft : null;
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

type Props<S extends z.ZodType> = Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'onChange'> & {
  path: string; method?: string; schema: S; read: (fields: FormData) => unknown;
  onSaved?: (receipt: z.output<S>) => void; confirm?: string; identity?: string; initialize?: (form: HTMLFormElement) => boolean; onRestored?: (fields: FormData) => void;
};

/** Keep the actual field draft until the server acknowledges that revision.
 * It is stored synchronously on edit, so navigation and even an offline tab
 * close cannot discard it. Only non-secret settings belong in this form. */
export function SettingsSaveForm<S extends z.ZodType>({ path, method = 'PUT', schema, read, onSaved, confirm, identity, initialize, onRestored, children, ...props }: Props<S>) {
  const { operator } = useRouteContext({ from: '/app' });
  const hydrated = useHydrated();
  const key = `vector:settings-draft:${operator.id}:${identity ?? path}`;
  const form = useRef<HTMLFormElement>(null), draft = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false), mounted = useRef(false);
  const departing = useRef(false);
  const current = useRef({ path, method, schema, read, onSaved });
  current.current = { path, method, schema, read, onSaved };
  const [state, setState] = useState<SaveState>('idle');
  const [field, setField] = useState<SaveField | null>(null);
  function status(next: typeof state) { if (mounted.current) setState(next); }
  async function flush() {
    clearTimeout(timer.current);
    const snapshot = draft.current;
    if (!snapshot || busy.current || !snapshot.valid || (confirm && !snapshot.confirmed)) return;
    const fields = new FormData();
    for (const [name, value] of snapshot.fields) fields.append(name, value);
    const options = current.current, body = options.read(fields);
    busy.current = true; status('saving');
    // A remount may join a still-running write. Serialize per setting so an
    // earlier receipt can never overtake a later edit in this document.
    const request = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => fetchJson(options.path, options.schema, {
      method: options.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true,
    }));
    writes.set(key, request);
    try {
      const receipt = await request;
      if (draft.current?.revision === snapshot.revision) {
        draft.current = null;
        // The next document may already contain an older server read. Let its
        // form restore this draft even when this outgoing write succeeds.
        try { if (!departing.current && readDraft(key)?.revision === snapshot.revision) localStorage.removeItem(key); } catch { /* The in-memory draft is still acknowledged. */ }
        status('saved');
      }
      options.onSaved?.(receipt);
    } catch { status('failed'); }
    finally {
      busy.current = false;
      if (writes.get(key) === request) writes.delete(key);
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
    const changed = target ?? element.querySelector('[name]');
    const editedField = changed instanceof HTMLInputElement || changed instanceof HTMLSelectElement || changed instanceof HTMLTextAreaElement ? saveField(changed) : undefined;
    if (editedField) setField(editedField);
    const fields: [string, string][] = [];
    for (const [name, value] of new FormData(element)) if (typeof value === 'string') fields.push([name, value]);
    draft.current = { revision: crypto.randomUUID(), fields, valid:element.checkValidity(), confirmed: false, field: editedField };
    try { localStorage.setItem(key, JSON.stringify(draft.current)); } catch { /* Keep the draft in this mounted form if device storage is unavailable. */ }
    status('dirty'); schedule();
  }
  useEffect(() => {
    if (!hydrated) return;
    mounted.current = true; departing.current = false;
    const first = form.current?.querySelector('[name]');
    if (first instanceof HTMLInputElement || first instanceof HTMLSelectElement || first instanceof HTMLTextAreaElement) setField(saveField(first));
    try {
      const saved = readDraft(key);
      if (saved && form.current) { draft.current = saved; restore(form.current, saved); if (saved.field) setField(saved.field); onRestored?.(new FormData(form.current)); status('dirty'); if (!confirm || saved.confirmed) timer.current = setTimeout(() => void flush(), 600); }
      else if (form.current && initialize?.(form.current)) edit();
    } catch { /* An unreadable device draft cannot replace current server values. */ }
    const leave = () => { departing.current = true; if (!confirm) void flush(); };
    window.addEventListener('beforeunload', leave);
    window.addEventListener('pagehide', leave);
    return () => { leave(); mounted.current = false; clearTimeout(timer.current); window.removeEventListener('beforeunload', leave); window.removeEventListener('pagehide', leave); };
  }, [key, hydrated]);
  return <SettingsSaveFeedback.Provider value={{state, field, retry: () => void flush(), ready: hydrated}}><form {...props} ref={form} onChange={event => edit(event.target)} onSubmit={event => {
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
