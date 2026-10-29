import type { Principal } from '../../../../vendor/base/agent-door/index.ts';
import { authorizeToken, tokenPredicate } from '../integrations/tokens';
import { admitted } from '../integrations/authority';

/** Reuse native API tokens and their exact scopes; no new credential issuer. */
export function nativeCredentials(db:D1Database) {
  const id=(client:string|undefined)=>client?.startsWith('vector-token:')?client.slice('vector-token:'.length):null;
  return {
    async localCredentials(request:Request) {
      if(!/^Bearer int_[a-f0-9]{64}$/.test(request.headers.get('authorization')??''))return null;
      try {
        const actor=await authorizeToken(db,request,[],'mcp');
        const token=await db.prepare('SELECT name,scopes FROM integration_tokens WHERE id=? AND namespace=?').bind(actor.tokenId,actor.namespace).first<{name:string;scopes:string}>();
        if(!token)return null;
        return {sponsor:{id:actor.id},agent:{id:`vector-token:${actor.tokenId}`,name:token.name,specialist:'software delivery coordinator'},scopes:JSON.parse(token.scopes) as string[],clientId:`vector-token:${actor.tokenId}`};
      }catch{return null;}
    },
    async currentScopes(p:Principal) {
      const tokenId=id(p.clientId);
      if(!tokenId)return p.scopes;
      const row=await db.prepare(`SELECT t.namespace,t.scopes,b.workspace_id AS workspace FROM integration_tokens t
        JOIN vector_integration_tokens b ON b.namespace=t.namespace AND b.token_id=t.id WHERE t.id=? AND b.operator_id=?`).bind(tokenId,p.person.id).first<{namespace:string;scopes:string;workspace:string}>();
      if(!row||!await admitted(db,tokenPredicate({id:p.person.id,namespace:row.namespace,workspace:row.workspace,tokenId,scopes:[]})))return [];
      return JSON.parse(row.scopes) as string[];
    },
  };
}
