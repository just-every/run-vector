import type {WorkerBindings} from '../../../app/bindings';
import type {z} from 'zod';
import {createUlid} from '../../../shared/ids';
import {auditStatement} from '../../audit/producer';
import {guardedSql,ownerPredicate,type IntegrationOwner} from '../authority';
import {newSigningSecret,sealSecret} from '../secrets';
import {IntegrationError} from '../errors';
import type {bitbucketConfiguration} from './input';
export async function registerBitbucket(env:WorkerBindings,owner:IntegrationOwner,input:z.infer<typeof bitbucketConfiguration>){
 if(input.repository.split('/').some(value=>value==='.'||value==='..'))throw new IntegrationError(400,'invalid_bitbucket_repository');
 const now=new Date(),id=createUlid(now),at=now.toISOString(),identity='bitbucket:'+id,secret=newSigningSecret(),encrypted=await sealSecret(env,identity,secret);
 try{await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:"SELECT CASE WHEN (SELECT count(*) FROM vector_bitbucket_repositories WHERE workspace_id=?)<50 THEN 1 ELSE json('bitbucket connection limit') END",params:[owner.workspace]},
  {sql:'INSERT INTO vector_bitbucket_repositories(id,workspace_id,repository,repository_uuid,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',params:[id,owner.workspace,input.repository,input.repositoryUuid,input.name,at,at]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:[identity,encrypted]},
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'integration.bitbucket_registered',subject:id,at}),
 ]);}catch{throw new IntegrationError(409,'bitbucket_configuration_conflict');}
 return {id,secret,receiver:env.APP_ORIGIN+'/api/integrations/bitbucket/'+id};
}
