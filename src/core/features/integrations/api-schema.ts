import document from '../../../../schema/api-v1.json';
export const apiSchema=document;
export const apiRoutes=Object.entries(document.paths).flatMap(([path,methods])=>Object.entries(methods).map(([method,operation])=>({
 path,method:method.toUpperCase(),scopes:operation['x-scopes'],list:operation['x-operation']==='list',
 pattern:new RegExp('^'+path.replace(/\{([^}]+)\}/g,(_all,key:string)=>key==='identifier'?'[A-Z]{2,10}-[1-9][0-9]*':'[0-9A-HJKMNP-TV-Z]{26}')+'$'),
})));
export function apiRoute(path:string,method:string){return apiRoutes.find(route=>route.method===method&&route.pattern.test(path));}
