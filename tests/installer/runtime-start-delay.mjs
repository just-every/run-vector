import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import {basename,join} from 'node:path';

export async function runtimeStartDelay(root,timing,slow) {
 const runtime=join(root,'node_modules/@runeditrun/rer/onboarding/production-runtime.mjs');
 const original=await readFile(runtime,'utf8'),mode=(await stat(runtime)).mode;
 const fixture=`import {writeFileSync,existsSync} from 'node:fs';\nconst first=!existsSync(${JSON.stringify(timing)});\nif(first)writeFileSync(${JSON.stringify(timing)},String(Date.now()));\nawait new Promise(resolve=>setTimeout(resolve,first&&${slow}?130000:1000));\n`+original;
 return store=>new Proxy(store,{get(target,key){
  if(key==='run')return async(label,command,args,options)=>{
   // Public rer install has finished before setup is dispatched. Installing the
   // fixture here survives pnpm recreating its package during that dependency step.
   if(command===process.execPath&&basename(args?.[0]??'')==='rer.mjs'&&args[1]==='setup'){
    const replacement=runtime+'.native-proof';
    // Replace the clone's entry; never write through a pnpm store hardlink.
    await writeFile(replacement,fixture,{flag:'wx',mode});
    await rename(replacement,runtime);
   }
   return target.run(label,command,args,options);
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}
