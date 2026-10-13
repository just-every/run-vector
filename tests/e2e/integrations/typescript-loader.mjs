import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export async function resolve(specifier,context,next){
 if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);for(const suffix of ['.ts','.tsx','/index.ts'])if(existsSync(fileURLToPath(url)+suffix))return {url:url.href+suffix,shortCircuit:true};}
 return next(specifier,context);
}
export async function load(url,context,next){
 if(url.endsWith('.json')){const value=JSON.parse(await readFile(new URL(url),'utf8'));return {format:'module',source:'export default '+JSON.stringify(value)+';',shortCircuit:true};}
 if(/\.tsx?$/.test(url)){const source=await readFile(new URL(url),'utf8');return {format:'module',source:ts.transpileModule(source,{fileName:fileURLToPath(url),compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};}
 return next(url,context);
}
