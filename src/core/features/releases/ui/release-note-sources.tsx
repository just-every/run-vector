import type {NoteSource} from '../notes/schema';

type Group={key:string;name:string;issues:NoteSource[]};
function groups(sources:NoteSource[]){
 const byProject=new Map<string,Group>();
 for(const source of sources){
  const key=source.projectId??'';
  let group=byProject.get(key);
  if(!group){group={key,name:source.projectId?source.projectName??'Project':'No project',issues:[]};byProject.set(key,group);}
  group.issues.push(source);
 }
 return [...byProject.values()];
}
const plural=(count:number,word:string)=>count+' '+word+(count===1?'':'s');

// The generation snapshot stays fixed through human edits and scope changes.
export function ReleaseNoteSources({sources}:{sources:NoteSource[]}){
 const grouped=groups(sources);
 return <details className="release-notes-sources" open>
  <summary>Generated from {plural(sources.length,'completed issue')} in {plural(grouped.length,'group')}</summary>
  {grouped.map(group=><section key={group.key} aria-label={'Sources: '+group.name}>
   <h3>{group.name} · {group.issues.length}</h3>
   <ul className="release-list">{group.issues.map(issue=><li key={issue.id}><a href={'/app/issues/'+issue.identifier}>{issue.identifier} · {issue.title}</a></li>)}</ul>
  </section>)}
 </details>;
}
