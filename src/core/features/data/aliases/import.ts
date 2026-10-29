import type {D1Sql} from '../../../../../vendor/base/import-kit/src/d1/index';
import {aliasKey} from './identity';
/** These statements share the native import batch and roll back with its issue.
 * An Owner-reviewed import activates new prefixes; an Owner can turn a prefix off. */
export function importAlias(workspace:string,source:string,key:string,issue:string,sourceUrl?:string,actor?:string,sourceId?:string):D1Sql[] {
 const normalized=aliasKey(key)??key.trim();if(!normalized)return [];
 const prefix=/^[A-Z][A-Z0-9_]{0,99}-[1-9][0-9]*$/.test(normalized)?normalized.slice(0,normalized.lastIndexOf('-')):source.replace(/^vector-import:/,'');
 const stable=sourceId?(aliasKey(sourceId)??sourceId.trim()):normalized;
 const keys=[...new Set([normalized,...(stable?[stable]:[]),...(sourceUrl&&aliasKey(sourceUrl)?[aliasKey(sourceUrl)!]:[])])];
 return [
  {sql:`INSERT INTO issue_alias_prefixes(workspace_id,prefix,active) VALUES(?,?,CASE WHEN EXISTS(SELECT 1 FROM main.operators WHERE id=? AND role='owner' AND removed_at IS NULL) THEN 1 ELSE 0 END) ON CONFLICT DO NOTHING`,params:[workspace,prefix,actor??null]},
  ...keys.map(value=>({sql:'INSERT INTO issue_aliases(workspace_id,source,source_key,prefix,issue_id) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING',params:[workspace,source,value,prefix,issue]})),
 ];
}
