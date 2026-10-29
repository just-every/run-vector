import { useRouteContext } from '@tanstack/react-router';
import { SettingsSaveForm } from './settings-save-form';
import { appearanceSchema, type ThemeChoice } from '../appearance-schema';
import './appearance.css';

const choices: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Follow this device’s light or dark setting.' },
  { value: 'light', label: 'Light', hint: 'Ink on light paper.' },
  { value: 'dark', label: 'Dark', hint: 'Light ink on a dark canvas.' },
];

export function AppearancePanel() {
  const { operator } = useRouteContext({ from: '/app' });
  return <section id="appearance" className="appearance-panel" aria-labelledby="appearance-heading">
    <h2 id="appearance-heading">Appearance</h2>
    <SettingsSaveForm path="/api/settings/appearance" method="PATCH" schema={appearanceSchema} aria-label="Theme" read={fields => ({theme:fields.get('theme')})}
      onRestored={fields => { document.documentElement.dataset.theme = String(fields.get('theme')); }}
      initialize={form => {
        const chosen = Array.from(form.elements).find(field => field instanceof HTMLInputElement && field.value === document.documentElement.dataset.theme);
        if (chosen instanceof HTMLInputElement) chosen.checked = true;
        return false;
      }}>
    <fieldset><legend>Theme</legend>
      {choices.map(choice => <label key={choice.value}>
        <input type="radio" name="theme" value={choice.value} defaultChecked={operator.theme === choice.value} onChange={() => { document.documentElement.dataset.theme = choice.value; }} />
        <span><strong>{choice.label}</strong><small>{choice.hint}</small></span>
      </label>)}
    </fieldset>
    </SettingsSaveForm>
  </section>;
}
