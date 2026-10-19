import { useViewerTime } from '../../../app/viewer-time';
import {z} from 'zod';
import {useApiResource} from '../../../app/api-client';
const schema=z.object({usage:z.array(z.object({id:z.string(),tokenId:z.string().nullable(),at:z.number(),requiredScopes:z.array(z.string()),allowed:z.boolean(),requestId:z.string().nullable(),resource:z.string().nullable()}))});
export function TokenUsage(){
  const { formatInstant } = useViewerTime();
 const resource=useApiResource('/api/settings/integrations/tokens/usage',schema);
 return <section aria-labelledby="token-usage-heading"><h4 id="token-usage-heading">Token usage</h4><p>History records API authority checks and route names. It contains no request body or credential.</p><button type="button" onClick={resource.reload}>Refresh token usage</button>{resource.error&&<p role="alert">{resource.error.message}</p>}<ul>{resource.data?.usage.map(row=><li key={row.id}><time dateTime={new Date(row.at).toISOString()}>{formatInstant(row.at)}</time> · {row.resource??'API request'} · {row.requiredScopes.join(', ')} · {row.allowed?'Allowed':'Refused'}</li>)}</ul></section>;
}
