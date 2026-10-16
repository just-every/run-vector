import { canonicalJson,sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';
import { sourceIdentity } from '../../../../../vendor/base/import-kit/src/provenance/identity';
import type { MappingResult,SourceBundle,TargetEffect } from '../../../../../vendor/base/import-kit/src/d1/index';
import { readNativeIssues } from './native-targets';
import { readJiraReviewedOmissions } from './jira-reused-review';
import { jiraHeader,jiraRelations } from './jira';
import { isLinear } from './linear';
import { loadImportReferences,importField,referenceAlias } from './references';
import { mapImportRow,rowOmissions,stableImportId,type MappedRow } from './row-values';
import type { ImportActor } from './authority';
import { importFields,type ImportDiagnostic,type ImportInput } from './types';

export async function mapImport(db:D1Database,actor:ImportActor,input:ImportInput,source:SourceBundle,effectiveAt:string,mappingVersion:string,origin:string) {
  const refs=await loadImportReferences(db,actor.workspace),errors:ImportDiagnostic[]=[],omissions:ImportDiagnostic[]=[],rows:MappedRow[]=[],effects=new Map<string,MappingResult>(),counters=new Map<string,number>(),floors=new Map<string,number>(),reusedRanks=new Map<string,number>();
  for(const [field,column] of Object.entries(input.mapping)) {
    if(!(importFields as readonly string[]).includes(field) || typeof column!=='string' || !source.records.some(record=>record.payload && typeof record.payload==='object' && !Array.isArray(record.payload) && Object.hasOwn(record.payload,column)))
      errors.push({row:0,field,code:'invalid_mapping',message:'Choose a column that exists in this file.'});
  }
  for(const required of ['sourceId','title','team','status'] as const)if(!input.mapping[required] && !input.defaults?.[required])
    errors.push({row:0,field:required,code:'missing_mapping',message:required==='sourceId'||required==='title'?'Choose its file column in Match your file to Vector.':'Choose its file column or a default in Match your file to Vector.'});
  const seen=new Map<string,{hash:string;row:number}>(),inRun=new Set(source.records.map(record=>record.sourceId));let reused=0;
  const identities=[...new Set(source.records.map(record=>sourceIdentity(actor.workspace,input.source,'issue',record.sourceId)))];
  const {erased,priors,natives}=await retainedSources(db,actor.workspace,identities);
  const reviewed=input.format==='jira-csv'?await readJiraReviewedOmissions(db,[...priors.values()].filter(prior=>!erased.has(prior.identity)).map(prior=>prior.job_id)):undefined;
  for(const record of source.records) {
    // Jira refuses repeated IDs in its reader and reviews every physical row.
    if(input.format!=='jira-csv' && seen.has(record.sourceId)) {
      if(seen.get(record.sourceId)!.hash!==record.payloadHash)for(const row of [seen.get(record.sourceId)!.row,record.location.row!])errors.push({row,field:'sourceId',code:'duplicate_source_conflict',message:'This source ID has different contents in the same file.'});
      continue;
    }
    seen.set(record.sourceId,{hash:record.payloadHash,row:record.location.row!});
    const refuse=(diagnostic:ImportDiagnostic)=>{
      errors.push(diagnostic);
      if(input.format==='jira-csv')omissions.push(...rowOmissions(record,input));
    };
    const identity=sourceIdentity(actor.workspace,input.source,'issue',record.sourceId);
    if(erased.has(identity)){refuse({row:record.location.row!,code:'source_erased',message:'This source record was erased. It cannot recreate its deleted issue.'});continue;}
    const prior=priors.get(identity);
    if(prior) {
      const current=natives.get(prior.target_id);
      const provenance=JSON.parse(prior.record_json) as {valueHash:string;appliedRevision:string};
      if(prior.source_hash!==record.payloadHash || prior.mapping_version!==mappingVersion) {
        refuse({row:record.location.row!,code:'source_content_conflict',message:'A retained source identity already has different contents or mapping. It cannot be overwritten.'});continue;
      }
      if(!current || current.revision!==provenance.appliedRevision || sha256(canonicalJson(current.value))!==provenance.valueHash) {
        refuse({row:record.location.row!,code:'native_edit_conflict',message:'This imported issue was edited or removed. Re-import will not overwrite it.'});continue;
      }
      const retained=reviewed?.get(prior.job_id)?.get(record.sourceId);
      if(input.format==='jira-csv'&&!retained){refuse({row:record.location.row!,code:'jira_review_unavailable',message:'The original reviewed omissions for this Jira source are unavailable. Its retained issue cannot be reviewed as a new import.'});continue;}
      const unmapped=retained?retained.map(item=>({...item,row:record.location.row!})):rowOmissions(record,input);omissions.push(...unmapped);
      effects.set(record.sourceId,{effects:[{targetKind:'issue',targetId:prior.target_id,value:current.value}],unmapped:unmapped.map(item=>({field:item.field,reason:item.message}))});
      reusedRanks.set(prior.target_id,prior.ordinal);reused++;continue;
    }
    let sequence=1;
    if(record.payload && typeof record.payload==='object' && !Array.isArray(record.payload)) {
      const raw=importField(input,record.payload,'team');
      const teamValue=typeof raw==='string'?raw:'';
      const selected=referenceAlias(input,'team',teamValue)??teamValue;
      const teams=refs.teams.filter(team=>team.id===selected || team.name===selected);
      if(teams.length===1) {
        const team=teams[0],prefix=String(team.identifier_prefix);
        if(!counters.has(prefix)) {
          const last=await db.prepare('SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=? AND identifier_prefix=?').bind(actor.workspace,prefix).first<number>('last_sequence');
          counters.set(prefix,last??0);
          floors.set(prefix,last??0);
        }
        sequence=counters.get(prefix)!+1;
        if(!Number.isSafeInteger(sequence)) { refuse({row:record.location.row!,code:'sequence_limit',message:'The team identifier sequence exceeds the safe integer bound.'});continue; }
        counters.set(prefix,sequence);
      }
    }
    const mapped=mapImportRow(record,input,refs,actor,effectiveAt,sequence,inRun);
    rows.push(mapped);errors.push(...mapped.errors);omissions.push(...mapped.omissions);
  }
  // "X blocks Y" belongs to Y's snapshot. Reusing Y cannot change a prior
  // run's snapshot or take ownership of it just to add X's dependency.
  const rowBySource=new Map(rows.map(row=>[row.record.sourceId,row]));
  for(const row of rows)for(const blocked of row.blocks) {
    const target=rowBySource.get(blocked);
    if(input.format==='jira-csv'&&!target?.value) {
      const retained=effects.has(blocked),problem={row:row.record.location.row!,code:retained?'retained_blocks_target':'invalid_issue_reference',message:retained?'This Blocks target is retained from a prior import run. Adding a blocker would change that run’s issue; this relationship cannot be imported.':'The Blocks target cannot be imported from this file. Resolve its row errors before applying.'};
      for(const relation of jiraRelations(row.record).filter(item=>jiraHeader(item.header)==='outward issue link (blocks)'&&item.target===blocked))
        errors.push({...problem,field:`${relation.header} [column ${relation.column}]`,column:relation.column,value:relation.value});
      continue;
    }
    if(target&&!target.dependencies.includes('source:'+row.record.sourceId))target.dependencies.push('source:'+row.record.sourceId);
  }
  const referenceValues=rows.flatMap(row=>[row.parent,...row.dependencies,row.duplicateOf]).filter(Boolean).map(value=>value.replace(/^native:/,''));
  const existing=(await db.prepare(`SELECT i.id,i.identifier,t.archived_at FROM issues i JOIN teams t ON t.id=i.team_id
    WHERE t.workspace_id=? AND (i.id IN (SELECT value FROM json_each(?)) OR i.identifier IN (SELECT value FROM json_each(?)))`).bind(actor.workspace,JSON.stringify(referenceValues),JSON.stringify(referenceValues)).all<{id:string;identifier:string;archived_at:string|null}>()).results;
  const bySource=new Map(rows.filter(row=>row.value).map(row=>[row.record.sourceId,{id:String(row.value!.issue.id),identifier:String(row.value!.issue.identifier),archived_at:null}]));
  for(const [sourceId,result] of effects) {
    const value=result.effects[0].value as {issue:{id:string;identifier:string}};
    bySource.set(sourceId,{...value.issue,archived_at:null});
  }
  // A Linear file names related issues by Linear ID (ENG-123), which can equal an
  // unrelated Vector identifier; there a plain reference means a source record.
  const selected=(value:string)=>{
    const nativeOnly=value.startsWith('native:'),sourceOnly=value.startsWith('source:') || ((isLinear(input.format)||input.format==='jira-csv') && !nativeOnly),text=value.replace(/^(?:native|source):/,'');
    const candidates=[...(!nativeOnly && bySource.has(text)?[bySource.get(text)!]:[]),...(!sourceOnly?existing.filter(row=>row.id===text || row.identifier===text):[])];
    const unique=[...new Map(candidates.map(row=>[row.id,row])).values()];
    if(unique.length!==1)throw Error(unique.length?'More than one issue matches. Prefix an original issue ID with source: for an issue in this file, or a Vector identifier with native: for an issue already in Vector.':'Issue reference was not found in this file or workspace.');
    if(unique[0].archived_at)throw Error('The referenced issue belongs to an archived team.');
    return unique[0];
  };
  const dependencies=new Map<string,string[]>();
  for(const row of rows) {
    if(!row.value)continue;
    const id=String(row.value.issue.id),needs:string[]=[];
    const reference=(field:string,value:string)=>{
      try{const target=selected(value);if(target.id===id)throw Error('An issue cannot reference itself.');needs.push(target.id);return target;}
      catch(error){errors.push({row:row.record.location.row!,field,code:'invalid_issue_reference',message:error instanceof Error?error.message:'Invalid reference.'});}
    };
    if(row.parent) { const target=reference('parent',row.parent);if(target)row.value.parent=[{issue_id:id,parent_issue_id:target.id,created_at:effectiveAt}]; }
    for(const value of row.dependencies){const target=reference('dependencies',value);if(target)row.value.dependencies.push({blocked_issue_id:id,blocking_issue_id:target.id,created_at:effectiveAt});}
    row.value.dependencies.sort((a,b)=>String(a.blocking_issue_id).localeCompare(String(b.blocking_issue_id)));
    if(row.duplicateOf) {
      const target=reference('duplicateOf',row.duplicateOf);
      if(target)row.value.links=[...row.value.links,{id:stableImportId(actor.workspace,input.source,row.record.sourceId,'duplicate-link'),issue_id:id,comment_id:null,actor_operator_id:actor.id,name:'Duplicate of '+target.identifier,url:origin+'/app/issues/'+encodeURIComponent(target.identifier),deleted_at:null,created_at:effectiveAt,updated_at:effectiveAt}].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    }
    dependencies.set(id,needs);
    const effect:TargetEffect={targetKind:'issue',targetId:id,value:row.value as unknown as TargetEffect['value']};
    effects.set(row.record.sourceId,{effects:[effect],unmapped:row.omissions.map(item=>({field:item.field,reason:item.message}))});
  }
  const order:string[]=[],visiting=new Set<string>(),done=new Set<string>(),byId=new Map(rows.filter(row=>row.value).map(row=>[String(row.value!.issue.id),row]));
  const visit=(id:string)=>{
    if(done.has(id) || !byId.has(id))return;
    if(visiting.has(id)){const row=byId.get(id)!;errors.push({row:row.record.location.row!,code:'reference_cycle',message:'Parent, dependency or duplicate references form a cycle.'});return;}
    visiting.add(id);for(const target of dependencies.get(id)??[])visit(target);visiting.delete(id);done.add(id);order.push(id);
  };
  byId.forEach((_row,id)=>visit(id));
  // Native identifiers follow publication order. A parent may appear later in
  // a source file, but must exist before its child's relationship is inserted.
  const next=new Map(floors),identifiers=new Map<string,string>();
  for(const id of order) {
    const row=byId.get(id)!,prefix=String(row.value!.issue.origin_prefix),sequence=next.get(prefix)!+1;
    next.set(prefix,sequence);row.value!.issue.sequence_number=sequence;row.value!.issue.identifier=prefix+'-'+sequence;
    identifiers.set(id,String(row.value!.issue.identifier));
  }
  for(const row of rows)if(row.value && row.duplicateOf) {
    const link=row.value.links.find(item=>item.id===stableImportId(actor.workspace,input.source,row.record.sourceId,'duplicate-link'));
    if(!link)continue;
    const target=selected(row.duplicateOf),identifier=identifiers.get(target.id)??target.identifier;
    link.name='Duplicate of '+identifier;
    link.url=origin+'/app/issues/'+encodeURIComponent(identifier);
  }
  const ranked=new Map(order.map((id,index)=>[id,index]));
  const records=[...source.records].sort((a,b)=>{
    const ai=effects.get(a.sourceId)?.effects[0]?.targetId,bi=effects.get(b.sourceId)?.effects[0]?.targetId;
    return (ranked.get(ai??'')??reusedRanks.get(ai??'')??-1)-(ranked.get(bi??'')??reusedRanks.get(bi??'')??-1);
  });
  return {source:{...source,records},effects,errors,omissions,reused,references:refs};
}

type Prior={job_id:string;identity:string;source_hash:string;mapping_version:string;target_id:string;record_json:string;ordinal:number};
/** Set reads: a preview of thousands of rows stays within D1's per-invocation
 * query limit. Identities are hashes, so each chunk binds a bounded value. */
async function retainedSources(db:D1Database,destination:string,identities:string[]) {
  const erased=new Set<string>(),priors=new Map<string,Prior>();
  for(let start=0;start<identities.length;start+=1000) {
    const chunk=JSON.stringify(identities.slice(start,start+1000));
    for(const row of (await db.prepare('SELECT identity FROM ik_d1_erased_sources WHERE destination=? AND identity IN (SELECT value FROM json_each(?))').bind(destination,chunk).all<{identity:string}>()).results)erased.add(row.identity);
    for(const row of (await db.prepare(`SELECT p.job_id,s.identity,s.source_hash,s.mapping_version,p.target_id,p.record_json,p.ordinal FROM ik_sources s
      JOIN ik_provenance p ON p.source_identity=s.identity AND p.job_id=s.job_id AND p.reversed=0 WHERE s.identity IN (SELECT value FROM json_each(?))`).bind(chunk).all<Prior>()).results)priors.set(row.identity,row);
  }
  return {erased,priors,natives:await readNativeIssues(db,destination,[...new Set([...priors.values()].map(row=>row.target_id))])};
}
