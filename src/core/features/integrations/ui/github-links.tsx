import {z} from 'zod';
import {useApiResource} from '../../../app/api-client';
const schema=z.object({
 pullRequests:z.array(z.object({repository:z.string(),number:z.number(),title:z.string(),url:z.string().url(),state:z.enum(['open','closed','merged']),updatedAt:z.string()})),
 commits:z.array(z.object({repository:z.string(),sha:z.string(),author:z.string(),subject:z.string(),url:z.string().url()})),
});
export function GithubLinks({identifier}:{identifier:string}){
 const resource=useApiResource('/api/issues/'+identifier+'/github',schema,undefined,{abortPendingOnDispose:false});
 if(resource.error)return <section className="detail-section"><h2>GitHub</h2><p role="alert">{resource.error.message}</p><button type="button" onClick={resource.reload}>Retry GitHub links</button></section>;
 if(!resource.data||(!resource.data.pullRequests.length&&!resource.data.commits.length))return null;
 return <section className="detail-section" aria-label="GitHub links"><h2>GitHub</h2>{resource.data.pullRequests.length>0&&<><h3>Pull requests</h3><ul>{resource.data.pullRequests.map(pr=><li key={pr.repository+':'+pr.number}><a href={pr.url} rel="noopener noreferrer" target="_blank">{pr.title} · {pr.repository} #{pr.number}</a><span> · {pr.state}</span></li>)}</ul></>}{resource.data.commits.length>0&&<><h3>Commits</h3><ul>{resource.data.commits.map(commit=><li key={commit.repository+':'+commit.sha}><a href={commit.url} rel="noopener noreferrer" target="_blank">{commit.subject}</a><span> · {commit.author} · {commit.sha.slice(0,7)}</span></li>)}</ul></>}</section>;
}
