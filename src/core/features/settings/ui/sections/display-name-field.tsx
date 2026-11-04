import { useRouteContext, useRouter } from '@tanstack/react-router';
import { fetchJson, useApiResource } from '../../../../app/api-client';
import { appearanceSchema } from '../../appearance-schema';
import { TextField } from '../fields/text-field';
import { useSettingsShell } from '../shell/settings-context';

export function DisplayNameField() {
  const { operator } = useRouteContext({ from: '/app' });
  const router = useRouter();
  const shell = useSettingsShell();
  const profile = useApiResource('/api/settings/appearance', appearanceSchema);
  return <TextField label="Display name" value={profile.data?.displayName ?? operator.name} className="field-wide" save={async displayName => {
    const updated = await fetchJson('/api/settings/appearance', appearanceSchema, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName }),
    });
    profile.publishReceipt(() => updated);
    shell.reload();
    await router.invalidate();
  }} />;
}
