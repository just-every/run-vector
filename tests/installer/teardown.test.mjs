import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {waitForPortRelease} from '../../scripts/installer/teardown.mjs';

test('setup drains an actual occupied port before handing it to development',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;let released=false;
 const pending=waitForPortRelease(origin,{intervalMs:5}).then(()=>{released=true});
 try {
  await new Promise(resolve=>setImmediate(resolve));assert.equal(released,false);
  await new Promise(resolve=>server.close(resolve));await pending;assert.equal(released,true);
 }finally{if(server.listening)await new Promise(resolve=>server.close(resolve));await pending;}
});
test('an occupied port fails boundedly without stopping another listener',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await assert.rejects(waitForPortRelease(`http://127.0.0.1:${server.address().port}`,{timeoutMs:20,intervalMs:5}),/has not stopped/);assert.equal(server.listening,true);}
 finally{await new Promise(resolve=>server.close(resolve));}
});
