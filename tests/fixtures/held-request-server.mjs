import {createServer} from 'node:http';
const server=createServer((req,res)=>{
 process.send({event:'admitted',method:req.method});
 req.resume();req.on('end',()=>{res.setHeader('Content-Type','application/json');res.setHeader('Keep-Alive','timeout=5');res.end('{"error":"unauthenticated"}');});
});
server.keepAliveTimeout=20;server.keepAliveTimeoutBuffer=0;
server.listen(0,'127.0.0.1',()=>process.send({event:'ready',port:server.address().port}));
process.on('message',message=>{if(message==='stop')server.close(()=>process.exit(0));});
