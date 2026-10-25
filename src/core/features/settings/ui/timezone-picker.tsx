import { useEffect, useId, useRef, useState } from 'react';
import './timezone-picker.css';

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export function timezoneName(zone: string) {
  if (zone === 'UTC' || zone === 'Etc/UTC') return 'UTC';
  return `${zone.split('/').at(-1)!.replaceAll('_', ' ')} time`;
}

/** Search narrows the places; the submitted control always holds an IANA id. */
export function TimezonePicker({ id, name = 'timezone', label, value, follow }: { id?: string; name?: string; label: string; value: string; follow?: string }) {
  const generated = useId(), control = id ?? generated;
  const [search, setSearch] = useState('');
  const selection = useRef<HTMLSelectElement>(null), previous = useRef(value), edited = useRef(false);
  useEffect(() => {
    const field = selection.current;
    if (field?.value === value) edited.current = false;
    else if (field && !edited.current && field.value === previous.current) field.value = value;
    previous.current = value;
  }, [value]);
  const zones = Array.from(new Set([value, 'UTC', ...Intl.supportedValuesOf('timeZone')])).filter(Boolean);
  const matches = (zone: string) => `${zone} ${timezoneName(zone)}`.toLowerCase().replaceAll('_', ' ').includes(search.toLowerCase());
  return <div className="timezone-picker">
    <label htmlFor={`${control}-search`}>Find a place</label>
    <input id={`${control}-search`} type="search" value={search} onChange={event => { event.stopPropagation(); setSearch(event.target.value); }} placeholder="Search places" />
    <label htmlFor={control}>{label}</label>
    <select ref={selection} id={control} name={name} defaultValue={value} required={!follow} onChange={() => { edited.current = true; }}>
      {follow && <option value="">Follow workspace ({timezoneName(follow)})</option>}
      {zones.map(zone => <option key={zone} value={zone} hidden={!matches(zone)}>{timezoneName(zone)} · {zone.replaceAll('_', ' ')}</option>)}
    </select>
  </div>;
}
