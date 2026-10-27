import { useApiResource } from '../../../app/api-client';
import { channelConfiguration } from '../../integrations/channels/schema';

export function CreateSlackChannel() {
  const config = useApiResource('/api/settings/integrations/channels', channelConfiguration);
  if (config.error) return <p role="alert">Slack availability could not be checked. <button type="button" onClick={config.reload}>Retry Slack availability</button></p>;
  if (!config.data?.slack.connected) return null;
  return <label className="admin-checkbox"><input name="createSlackChannel" type="checkbox" />Create Slack channel</label>;
}
