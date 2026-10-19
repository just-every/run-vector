import { createContext, useContext, type ReactNode } from 'react';
import { z } from 'zod';
import { useApiResource } from './api-client';
import { personalTimeSchema } from '../features/settings/personal-time-schema';
import { localTimeToInstant } from '../features/administration/calendar';

export const viewerTimeSchema = personalTimeSchema.extend({ workspaceTimezone: z.string(), reminderTime: z.string() });
type Clock = z.infer<typeof viewerTimeSchema>;
type ViewerTime = Clock & {
  formatInstant: (value: string | number) => string;
  localValue: (date: Date) => string;
  futureInstant: (value: string) => string;
  publish: (value: Clock) => void;
};
const Context = createContext<ViewerTime | null>(null);
export function ViewerTimeProvider({ children }: { children: ReactNode }) {
  const resource = useApiResource('/api/settings/personal-time', viewerTimeSchema, 30000);
  if (!resource.data) return <main aria-live="polite">{resource.error
    ? <p role="alert">Your time preferences could not be loaded. <button onClick={resource.reload}>Retry time preferences</button></p>
    : <p>Loading your time preferences…</p>}</main>;
  const clock = resource.data;
  const value: ViewerTime = {
    ...clock,
    formatInstant: value => new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium', timeStyle: 'short', timeZone: clock.effectiveTimezone,
    }).format(new Date(value)) + (clock.effectiveTimezone !== clock.workspaceTimezone ? ` (${clock.effectiveTimezone})` : ''),
    localValue: date => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: clock.effectiveTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(date).map(p => [p.type, p.value]));
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
    },
    futureInstant: value => {
      const instant = localTimeToInstant(value, clock.effectiveTimezone);
      if (Date.parse(instant) <= Date.now()) throw Error('Choose a future date and time.');
      return instant;
    },
    publish: value => resource.publishReceipt(() => value),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useViewerTime() {
  const clock = useContext(Context);
  if (!clock) throw Error('Viewer time requires the authenticated app context.');
  return clock;
}
