/** Full operation qualification is separate from an honest, partial route inventory. */
export function apiCoverage(schema: { 'x-object-coverage': Record<string, {status:string;clause?:string;operations?:Record<string,{routes?:string[];status?:string;reason?:string}>}>;paths:Record<string,Record<string,{'x-object':string;'x-operation':string;'x-pagination'?:string;'x-filters'?:string[]}>> }) {
 const objects='issues,comments,attachments,relations,labels,teams,workflow states,cycles,projects,milestones,initiatives,releases,documents,views,customers,customer requests,notifications,members'.split(',');
 const missing:string[]=[],unbuilt:string[]=[];
 for(const name of objects){
  const object=schema['x-object-coverage'][name];
  if(object?.status==='not-built'&&object.clause){unbuilt.push(name+' ('+object.clause+')');continue;}
  for(const operation of ['list','get','create','update','delete']){
   const entry=object?.operations?.[operation];
   if(entry?.status==='read-only'&&entry.reason)continue;
   const valid=entry?.routes?.length&&entry.routes.every(reference=>{
    const [method,path]=reference.split(' '),route=schema.paths[path]?.[method.toLowerCase()];
    return route?.['x-object']===name&&route['x-operation']===operation&&(operation!=='list'||route['x-pagination']==='cursor'&&Boolean(route['x-filters']?.length));
   });
   if(!valid)missing.push(name+'.'+operation);
  }
 }
 return {complete:missing.length===0&&unbuilt.length===0,implementedCoverage:missing.length===0,missing,unbuilt};
}
