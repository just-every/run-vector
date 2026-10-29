/** Accept only documented source URLs; no provider request is made. */
export function aliasKey(value:string):string|null {
 const text=value.trim();
 if(/^[A-Z][A-Z0-9_]{0,99}-[1-9][0-9]*$/i.test(text))return text.toUpperCase();
 let url:URL;try{url=new URL(text);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
 const github=url.hostname==='github.com'?url.pathname.match(/^\/([A-Z0-9_.-]+)\/([A-Z0-9_.-]+)\/issues\/([1-9][0-9]*)(?:\/|$)/i):null;
 if(github)return 'https://github.com/'+github[1].toLowerCase()+'/'+github[2].toLowerCase()+'/issues/'+github[3];
 const match=url.hostname==='linear.app'?url.pathname.match(/^\/[^/]+\/issue\/([A-Z][A-Z0-9_]{0,99}-[1-9][0-9]*)(?:\/|$)/i)
  :url.hostname.endsWith('.atlassian.net')?url.pathname.match(/^\/browse\/([A-Z][A-Z0-9_]{0,99}-[1-9][0-9]*)(?:\/|$)/i):null;
 return match?.[1]?.toUpperCase()??null;
}
/** Native identity wins even when it is invisible to this reader. Ambiguous
 * imports refuse rather than choosing a source or revealing a hidden target. */
export function aliasTargetSql(workspace:string,key:string) {
 return `(SELECT COALESCE((SELECT n.id FROM main.issues n JOIN main.teams nt ON nt.id=n.team_id WHERE nt.workspace_id=${workspace} AND n.identifier=alias_input.value COLLATE NOCASE),
  (SELECT CASE WHEN count(DISTINCT a.issue_id)=1 THEN min(a.issue_id) END FROM issue_aliases a JOIN issue_alias_prefixes p ON p.workspace_id=a.workspace_id AND p.prefix=a.prefix
   WHERE a.workspace_id=${workspace} AND a.source_key=alias_input.value COLLATE NOCASE AND p.active=1)) FROM (SELECT ${key} AS value) alias_input)`;
}
