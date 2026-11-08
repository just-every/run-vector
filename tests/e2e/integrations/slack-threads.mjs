import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
/** The existing discussion interface renders mapped roots, source links and
 * resolution; this journey adds no interface design or new product controls. */
export async function exerciseSlackThreads({page,runtime,cookie,width,evidence,fixture,issue,payload}){
 const errors=[],onError=error=>errors.push(error.message);
 page.on('pageerror',onError);
 const send=async(value)=>{
  const body=JSON.stringify(value),timestamp=String(Math.floor(Date.now()/1000));
  const response=await runtime.req('/api/integrations/slack/events',{method:'POST',headers:{'content-type':'application/json','x-slack-request-timestamp':timestamp,'x-slack-signature':'v0='+createHmac('sha256',fixture.signingSecret).update('v0:'+timestamp+':'+body).digest('hex')},body});
  assert.equal(response.status,200);return response.json();
 };
 const read=async()=>{const response=await runtime.req('/api/issues/'+issue.identifier+'/discussion',{headers:{Cookie:cookie}});assert.equal(response.status,200);return response.json();};
 const root=(await read()).comments.find(c=>!c.parentId);
 const secondTs=String(1730100000+width)+'.000001';
 await send({...payload,event_id:'synthetic-vector-browser-second-'+width,event:{...payload.event,ts:secondTs,text:'<@'+fixture.botId+'> add '+issue.identifier+' Second linked Slack source'}});
 await send({...payload,event_id:'synthetic-vector-browser-reply-'+width,event:{...payload.event,type:'message',ts:payload.event.ts.replace('000001','000010'),thread_ts:payload.event.ts,text:'Slack browser thread reply'}});
 await page.reload();
 const threads=page.getByRole('region',{name:/^Thread started by/});
 const first=threads.filter({has:page.getByText('Slack browser thread reply',{exact:true})});
 await first.getByText('Slack browser thread reply',{exact:true}).waitFor();
 assert.equal(await threads.count(),2);
 await threads.filter({hasText:'Second linked Slack source'}).getByRole('link',{name:/https:\/\/synthetic-vector\.slack\.com\/archives/}).waitFor();
 await first.getByRole('link',{name:/https:\/\/synthetic-vector\.slack\.com\/archives/}).waitFor();
 const reaction=first.getByRole('button',{name:'Add 👍 reaction',exact:true}).first();
 await reaction.focus();await page.getByRole('tooltip',{name:'Add 👍 reaction',exact:true}).waitFor();await reaction.blur();
 const reply=first.getByRole('button',{name:'Reply',exact:true});
 await reply.focus();await page.keyboard.press('Enter');
 const editor=first.getByRole('textbox',{name:'Reply to thread',exact:true});await editor.fill('Vector browser thread reply');
 const posted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues/'+issue.identifier+'/comments'&&r.request().method()==='POST');
 await first.getByRole('button',{name:'Post reply',exact:true}).click();assert.equal((await posted).status(),201);
 await first.getByText('Vector browser thread reply',{exact:true}).waitFor();
 const current=await read();assert.equal(current.comments.filter(c=>c.parentId===root.id).length,2);
 const secondRoot=current.comments.find(c=>!c.parentId&&c.id!==root.id);assert.ok(secondRoot);assert.equal(current.comments.filter(c=>c.parentId===secondRoot.id).length,0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mapped threads do not overflow');
 await first.scrollIntoViewIfNeeded();await page.screenshot({fullPage:true,path:resolve(evidence,'slack-mapped-threads-'+width+'.png')});
 await first.getByRole('button',{name:'Resolve thread',exact:true}).focus();await page.keyboard.press('Enter');
 const resolved=page.getByRole('region',{name:/^Resolved thread/});await resolved.getByText(/Resolved by/).waitFor();
 await page.reload();await resolved.getByText(/Resolved by/).waitFor();
 assert.equal(await resolved.locator('.comment-entry').count(),0);
 await resolved.scrollIntoViewIfNeeded();await page.screenshot({fullPage:true,path:resolve(evidence,'slack-mapped-resolved-'+width+'.png')});
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 assert.deepEqual(await page.evaluate(async()=>{const result=await axe.run();return result.violations.filter(v=>['serious','critical'].includes(v.impact));}),[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'resolved threads do not overflow');
 assert.deepEqual(errors,[]);page.off('pageerror',onError);
}
