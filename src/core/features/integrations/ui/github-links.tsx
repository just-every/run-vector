import {z} from 'zod';
import {useApiResource} from '../../../app/api-client';
const schema=z.object({pullRequests:z.array(z.object({repository:z.string(),number:z.number(),title:z.string(),url:z.string().url(),state:z.enum(['open','closed','merged']),updatedAt:z.string()}))});
export function GithubLinks({identifier}:{identifier:string}){
 const resource=useApiResource('/api/issues/'+identifier+'/github',schema,undefined,{abortPendingOnDispose:false});
 if(resource.error)return <section className="detail-section"><h2>Pull requests</h2><p role="alert">{resource.error.message}</p><button type="button" onClick={resource.reload}>Retry pull requests</button></section>;
 if(!resource.data?.pullRequests.length)return null;
 return <section className="detail-section"><h2>Pull requests</h2><ul>{resource.data.pullRequests.map(pr=><li key={pr.repository+':'+pr.number}><a href={pr.url} rel="noopener noreferrer" target="_blank">{pr.title} · {pr.repository} #{pr.number}</a><span> · {pr.state}</span></li>)}</ul></section>;
}
