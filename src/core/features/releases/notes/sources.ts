import type {NoteSource} from './schema';

// A release can include the same issue directly and through its project.
const membership=(issue:string)=>`(EXISTS(SELECT 1 FROM release_issues s WHERE s.release_id=r.id AND s.issue_id=${issue}.id)
 OR EXISTS(SELECT 1 FROM release_projects p WHERE p.release_id=r.id AND p.project_id=${issue}.project_id))`;
const scope=(issue:string)=>`t.workspace_id=r.workspace_id AND (r.team_id IS NULL OR ${issue}.team_id=r.team_id) AND ${membership(issue)}`;
export const currentSources=`SELECT i.id,i.identifier,i.title,i.project_id AS projectId,p.name AS projectName
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN releases r ON r.id=?
 JOIN workflow_statuses s ON s.id=i.status_id LEFT JOIN projects p ON p.id=i.project_id
 WHERE ${scope('i')} AND s.category='completed'
 ORDER BY COALESCE(p.name,''),COALESCE(p.id,''),i.identifier,i.id`;
export const sourceSnapshot=`SELECT json_group_array(json_object('id',id,'identifier',identifier,'title',title,
 'projectId',projectId,'projectName',projectName)) AS snapshot FROM (${currentSources})`;
// The unprojected comparison reveals no identities. Refuse the entire draft
// instead of silently dropping a private contribution from its source set.
export const currentScopeVisible=`NOT EXISTS(SELECT 1 FROM main.issues hidden
 JOIN main.teams t ON t.id=hidden.team_id JOIN releases r ON r.id=?
 WHERE ${scope('hidden')} AND hidden.id NOT IN(SELECT id FROM issues))`;
export const retainedSourcesVisible=`NOT EXISTS(SELECT 1 FROM json_each(?) source WHERE
 NOT EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=json_extract(source.value,'$.id')
 AND i.identifier=json_extract(source.value,'$.identifier') AND t.workspace_id=?)
 OR (json_extract(source.value,'$.projectId') IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM projects p WHERE p.id=json_extract(source.value,'$.projectId') AND p.workspace_id=?)))`;

const inline=(text:string)=>text.replace(/[\r\n]+/g,' ').replace(/[\\`*_{}\[\]<>()#!|~]/g,'\\$&');
export function draftMarkdown(sources:NoteSource[]){
 const groups=new Map<string|null,{name:string|null;issues:NoteSource[]}>();
 for(const source of sources){
  let group=groups.get(source.projectId);
  if(!group){group={name:source.projectName,issues:[]};groups.set(source.projectId,group);}
  group.issues.push(source);
 }
 return [...groups].map(([id,group])=>
  '## '+(id?'['+inline(group.name??'Project')+'](/app/projects/'+id+')':'No project')+'\n\n'+
  group.issues.map(issue=>'- ['+issue.identifier+'](/app/issues/'+issue.identifier+') — '+inline(issue.title)).join('\n')
 ).join('\n\n')+'\n';
}
