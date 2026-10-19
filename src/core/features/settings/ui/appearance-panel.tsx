import { useState } from 'react';
import { useRouteContext } from '@tanstack/react-router';
import { fetchJson } from '../../../app/api-client';
import { appearanceSchema, type ThemeChoice } from '../appearance-schema';
import './appearance.css';

const choices: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Follow this device’s light or dark setting.' },
  { value: 'light', label: 'Light', hint: 'Ink on light paper.' },
  { value: 'dark', label: 'Dark', hint: 'Light ink on a dark canvas.' },
];

export function AppearancePanel() {
  const { operator } = useRouteContext({ from: '/app' });
  const [theme, setTheme] = useState<ThemeChoice>(operator.theme);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function choose(next: ThemeChoice) {
    const previous = theme;
    setTheme(next); setBusy(true); setMessage('');
    // The page follows the choice at once; <html data-theme> is server-rendered from the saved value on the next load.
    document.documentElement.dataset.theme = next;
    try {
      await fetchJson('/api/settings/appearance', appearanceSchema, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme: next }),
      });
      setMessage('Your theme is saved for every browser you sign in to.');
    } catch (error) {
      setTheme(previous); document.documentElement.dataset.theme = previous;
      setMessage(error instanceof Error ? error.message : 'Your theme could not be saved.');
    } finally { setBusy(false); }
  }
  return <section id="appearance" className="appearance-panel" aria-labelledby="appearance-heading">
    <h2 id="appearance-heading">Appearance</h2>
    <fieldset disabled={busy}><legend>Theme</legend>
      {choices.map(choice => <label key={choice.value}>
        <input type="radio" name="theme" value={choice.value} checked={theme === choice.value} onChange={() => choose(choice.value)} />
        <span><strong>{choice.label}</strong><small>{choice.hint}</small></span>
      </label>)}
    </fieldset>
    {message && <p role="status">{message}</p>}
  </section>;
}
