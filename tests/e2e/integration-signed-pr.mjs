import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
// Public GitHub example repositories, one per browser width.
const repositories={1440:'octocat/linguist',390:'octocat/test-repo1'};
export function pullRequestRepository(width){const repository=repositories[width];assert(repository,'No fixture repository for width '+width);return repository;}
export async function sendSignedPullRequest(config,identifier,width){
 const repository=pullRequestRepository(width);
 for(const [action,state,merged,updated_at] of [['opened','open',false,'2026-10-01T00:00:00.000Z'],['closed','closed',true,'2026-10-02T00:00:00.000Z']]){
  const body=JSON.stringify({action,number:42,repository:{full_name:repository},pull_request:{number:42,title:'Fix '+identifier,body:'Explicit '+identifier,html_url:'https://github.com/'+repository+'/pull/42',state,merged,updated_at}}),signature=createHmac('sha256',config.secret).update(body).digest('hex');
  const response=await fetch(config.receiver,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+signature,'X-GitHub-Delivery':randomUUID(),'X-GitHub-Event':'pull_request'},body});assert.equal(response.status,200);await response.body.cancel();
 }
}
