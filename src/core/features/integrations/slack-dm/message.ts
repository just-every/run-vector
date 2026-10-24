/** A direct message carries only the event kind, identifier and title, actor display name,
 * status change, due date and the authenticated canonical link (ct, 20 Oct 19:12Z).
 * Plain-text blocks and escaped fallback text keep issue text from forming Slack markup. */
export type DirectIssue={identifier:string;title:string;version:number;dueDate:string|null;statusId:string;statusCategory:string;statuses:{id:string;name:string}[]};
const escapeSlack=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const plain=(text:string,limit=3000)=>({type:'plain_text',text:text.slice(0,limit),emoji:false});
export const issueLink=(origin:string,identifier:string)=>origin.replace(/\/$/,'')+'/app/issues/'+encodeURIComponent(identifier);
export function kindHeadline(assignment:boolean,mention:boolean,kinds:string[]=[]){
 if(!assignment&&!mention)return kinds.map(kind=>kind.replaceAll('_',' ')).join(', ');
 return assignment&&mention?'Assigned to you, and you were mentioned':assignment?'Assigned to you':'You were mentioned';
}
/** Assign to me and Change status appear only while the signing secret can verify their requests. */
export function directMessage(origin:string,issue:DirectIssue,headline:string,context:string[],actions:boolean){
 const summary=headline+': '+issue.identifier+' · '+issue.title,elements:unknown[]=[{type:'button',action_id:'vector_open',text:plain('Open',75),url:issueLink(origin,issue.identifier)}];
 if(actions){
  elements.push({type:'button',action_id:'vector_assign_me',text:plain('Assign to me',75),value:issue.identifier+':'+issue.version});
  if(!['intake','duplicate'].includes(issue.statusCategory)){
   const options=issue.statuses.slice(0,100).map(status=>({text:plain(status.name,75),value:issue.identifier+':'+issue.version+':'+status.id}));
   const current=options.find(option=>option.value.endsWith(':'+issue.statusId));
   elements.push({type:'static_select',action_id:'vector_change_status',placeholder:plain('Change status',150),options,...(current?{initial_option:current}:{})});
  }
 }
 const notes=[...context,...(issue.dueDate?['Due '+issue.dueDate]:[])];
 return {text:escapeSlack(summary),blocks:[
  {type:'section',text:plain(summary)},
  ...(notes.length?[{type:'context',elements:notes.slice(0,10).map(note=>plain(note))}]:[]),
  {type:'actions',block_id:'vector_issue',elements},
 ]};
}
/** The exact immutable chat.postMessage body; the opened DM channel is prefixed at send time. */
export function directBody(origin:string,issue:DirectIssue,headline:string,actor:string|null,actions:boolean){
 return JSON.stringify({...directMessage(origin,issue,headline,['By '+(actor??'Vector')],actions),unfurl_links:false,unfurl_media:false});
}
export function refusalMessage(origin:string,identifier:string,reason:string){
 return {text:escapeSlack(identifier+': '+reason),blocks:[{type:'section',text:plain(identifier+': '+reason)},{type:'actions',block_id:'vector_issue',elements:[{type:'button',action_id:'vector_open',text:plain('Open '+identifier,75),url:issueLink(origin,identifier)}]}],unfurl_links:false,unfurl_media:false};
}

/** Private items disclose no actor, title, status or excerpt to Slack. */
export function privateDirectBody(origin:string,identifier:string){
 return JSON.stringify({text:'Private work changed. Sign in to Vector to view it.',blocks:[{type:'section',text:plain('Private work changed. Sign in to Vector to view it.')},{type:'actions',elements:[{type:'button',action_id:'vector_open',text:plain('Open Vector',75),url:issueLink(origin,identifier)}]}],unfurl_links:false,unfurl_media:false});
}
