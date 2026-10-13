import {mkdtemp,rm,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {dataInstallation} from './data-installation.mjs';

export async function startDataUiInstallation(){
 const work=await mkdtemp(join(tmpdir(),'vector-data-ui-'));let installation;
 const close=async()=>{try{await installation?.close();}finally{await rm(work,{recursive:true,force:true});}};
 try{
  installation=await dataInstallation(work,'installation');
  await installation.configure(true);
  // Vite browser modules must resolve inside this genuine cloned installation.
  await unlink(join(installation.root,'node_modules'));
  await installation.installDependencies();await installation.start();
  const cookie=await installation.signIn(),base=installation.origin;
  const req=async(path,init={})=>{
   const response=await fetch(base+path,{redirect:'manual',...init,headers:{Origin:base,...init.headers}});
   const bytes=await response.arrayBuffer();
   return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
  };
  return {cookie,close,runtime:{base,req,sql:installation.sql,writeFixture:installation.fixture}};
 }catch(error){await close();throw error;}
}
