import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// A launcher may close before its local runtime releases the listening socket.
// Setup must not hand that old health endpoint to the next development process.
export async function waitForPortRelease(origin, {timeoutMs=10000, intervalMs=25}={}) {
 const url=new URL(origin),deadline=Date.now()+timeoutMs;
 for(;;) {
  const free=await new Promise((resolve,reject)=>{
   const server=createServer();
   server.once('error',error=>error.code==='EADDRINUSE'?resolve(false):reject(error));
   server.listen(Number(url.port),'127.0.0.1',()=>server.close(()=>resolve(true)));
  });
  if(free)return;
  if(Date.now()>=deadline)throw Error('The setup application has not stopped; its local port is still in use.');
  await delay(Math.min(intervalMs,deadline-Date.now()));
 }
}
