// External focused evidence harness. Runs the existing pagination/suspension
// journey unchanged, with a minimal native owner/member/issue setup.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const require = createRequire(resolve('package.json'));
const { chromium } = require('@playwright/test');
const moduleAt = path => import(pathToFileURL(resolve(path)).href);
const { collaborationRuntime, inviteRecipient, receipt } = await moduleAt('tests/e2e/collaboration-support.mjs');
const { bootstrapOwner } = await moduleAt('tests/e2e/admin-runtime-support.mjs');
const { navigate } = await moduleAt('tests/e2e/collaboration-navigation.mjs');
const { paginationAndRemoval } = await moduleAt('tests/e2e/collaboration-pagination.mjs');
const evidence = resolve('../browser-focused');
await mkdir(evidence, {recursive:true});
let runtime, browser, context, recipient;
try {
  runtime = await collaborationRuntime(1440);
  runtime.initialize();
  await runtime.start();
  browser = await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  await bootstrapOwner(page,runtime);
  recipient = await inviteRecipient({page,browser,runtime});
  const {peer,operator} = recipient;
  const team = runtime.sql('SELECT id FROM teams ORDER BY id LIMIT 1')[0];
  const created = await page.request.post(runtime.base+'/api/issues', {
    headers:{Origin:runtime.base},data:{title:'Focused suspension Inbox custody',teamId:team.id,assigneeOperatorId:operator.id},
  });
  assert.equal(created.status(),201);
  const issue = await created.json();
  const subscription = await peer.request.patch(runtime.base+'/api/issues/'+issue.identifier+'/subscription', {
    headers:{Origin:runtime.base},data:{following:true},
  });
  assert.equal(subscription.status(),200);
  await navigate(page,runtime.base+'/app/issues/'+issue.identifier);
  await page.getByLabel('Add a comment',{exact:true}).waitFor();
  async function comment(text) {
    await page.getByLabel('Add a comment',{exact:true}).fill(text);
    assert.equal(await page.getByRole('textbox',{name:'Add a comment',exact:true}).count(),1);
    await receipt(page,'/api/issues/'+issue.identifier+'/comments','POST',()=>page.getByRole('button',{name:'Add comment',exact:true}).click());
  }
  const captureFor = actor => async name => {
    if (name==='operator-removal-confirmation' || name==='inbox-revoked-session-clears-all-pages')
      await actor.screenshot({path:resolve(evidence,'1440-'+name+'.png'),fullPage:true});
  };
  const fixtures=[];
  await paginationAndRemoval({page,peer,runtime,operator,comment,
    capture:captureFor(page),peerCapture:captureFor(peer),fixtures,
    clause:async(id,name,run)=>{await run();console.log('PASS '+id+' '+name);},
  });
  console.log(JSON.stringify({passed:true,width:1440,fixtures,
    remainingNotifications:runtime.sql(`SELECT count(*) n FROM notifications WHERE recipient_id='${operator.id}'`)[0].n,
  }));
} finally {
  await recipient?.context.close();
  await context?.close();
  await browser?.close();
  await runtime?.stop();
}
