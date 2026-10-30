import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
// Public GitHub example repositories, one per browser width.
const repositories={1440:'octocat/linguist',390:'octocat/test-repo1'};
export function pullRequestRepository(width){const repository=repositories[width];assert(repository,'No fixture repository for width '+width);return repository;}
const post=(config,{body,delivery},secret)=>fetch(config.receiver,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+createHmac('sha256',secret).update(body).digest('hex'),'X-GitHub-Delivery':delivery,'X-GitHub-Event':'pull_request'},body});
/** Sends the opened and merged deliveries and returns them, so a journey can replay one exactly. */
export async function sendSignedPullRequest(config,identifier,width){
 const repository=pullRequestRepository(width),sent=[];
 for(const [action,state,merged,updated_at] of [['opened','open',false,'2026-10-01T00:00:00.000Z'],['closed','closed',true,'2026-10-02T00:00:00.000Z']]){
  const delivery={body:JSON.stringify({action,number:42,repository:{full_name:repository},pull_request:{number:42,title:'Fix '+identifier,body:'Explicit '+identifier,html_url:'https://github.com/'+repository+'/pull/42',state,merged,updated_at}}),delivery:randomUUID()};
  const response=await post(config,delivery,config.secret);assert.equal(response.status,200);await response.body.cancel();sent.push(delivery);
 }
 return sent;
}
/** Posts a delivery's exact bytes again, signed with the given secret, and returns the receiver's status. */
export async function resendPullRequest(config,delivery,secret=config.secret){const response=await post(config,delivery,secret);await response.body.cancel();return response.status;}
