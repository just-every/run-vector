import {z} from 'zod';
import {useApiResource} from '../../../app/api-client';
const schema=z.object({pullRequests:z.array(z.object({repository:z.string(),number:z.number(),title:z.string(),url:z.string().url(),state:z.enum(['OPEN','MERGED']),updatedAt:z.string()}))});
export function BitbucketLinks({identifier}:{identifier:string}){
 const resource=useApiResource('/api/issues/'+identifier+'/bitbucket',schema,undefined,{abortPendingOnDispose:false});
 if(resource.error)return <section className="detail-section"><h2>Bitbucket</h2><p role="alert">{resource.error.message}</p><button type="button" onClick={resource.reload}>Retry Bitbucket links</button></section>;
 if(!resource.data?.pullRequests.length)return null;
 return <section className="detail-section" aria-label="Bitbucket links"><h2>Bitbucket</h2><ul>{resource.data.pullRequests.map(pr=><li key={pr.repository+':'+pr.number}><a href={pr.url} target="_blank" rel="noopener noreferrer">{pr.title} · {pr.repository} #{pr.number}</a><span> · {pr.state==='MERGED'?'Merged':'Open'}</span></li>)}</ul></section>;
}
