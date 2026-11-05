import { z } from 'zod'
import { AuthError } from '../../../../vendor/base/operator-auth/index.mjs'
import { sealSecret, openSecret } from '../integrations/secrets'
import { requireOperator } from './service'
import { mutationDatabase } from './mutation-database'
import { administrationContext, audit } from '../administration/transaction'
import type { WorkerBindings } from '../../app/bindings'

import { googleSettingsSchema } from './google-schema'
const input = z.object({ clientId:z.string().trim().min(1).max(512).regex(/^[^\x00-\x1f\x7f]+$/), clientSecret:z.string().min(1).max(4096) }).strict()
export type GoogleConfiguration = { singleton:number; client_id:string; secret:string; transaction_secret:string; generation:number; enabled:number; tested:number; test_session_id:string }
export const googleConfiguration = (db:D1Database) => db.prepare('SELECT * FROM vector_google_configuration WHERE singleton=1').first<GoogleConfiguration>()
export async function googleOwner(env:WorkerBindings, request:Request) {
  const operator=await requireOperator(env,request)
  if(!operator) throw new AuthError('unauthenticated',401)
  const current=await env.DB.prepare("SELECT role FROM operators WHERE id=? AND removed_at IS NULL").bind(operator.id).first<{role:string}>()
  if(current?.role!=='owner') throw new AuthError('owner_required',403)
  const db=mutationDatabase(env.DB,operator.id,operator.fence,undefined,{sql:"EXISTS(SELECT 1 FROM operators WHERE id=? AND role='owner' AND removed_at IS NULL)",values:[operator.id]})
  return {operator,db}
}
export async function readGoogleSettings(env:WorkerBindings, request:Request) {
  await googleOwner(env,request)
  const row=await googleConfiguration(env.DB)
  return googleSettingsSchema.parse({configured:!!row,clientId:row?.client_id??'',tested:row?.tested===1,enabled:row?.enabled===1,redirectUri:env.APP_ORIGIN+'/auth/oidc/google/callback',javascriptOrigin:env.APP_ORIGIN})
}
export async function saveGoogleSettings(env:WorkerBindings, request:Request, body:unknown) {
  const {operator,db}=await googleOwner(env,request)
  const parsed=input.safeParse(body)
  if(!parsed.success) throw new AuthError('invalid_input',400)
  const secret=await sealSecret(env,'google-client',parsed.data.clientSecret)
  const transaction=await sealSecret(env,'google-transaction',crypto.randomUUID()+crypto.randomUUID())
  const ctx=await administrationContext(db,operator.id)
  await db.batch([
    db.prepare(`INSERT INTO vector_google_configuration(singleton,client_id,secret,transaction_secret,generation,enabled,tested,test_session_id)
      VALUES(1,?,?,?,1,0,0,?) ON CONFLICT(singleton) DO UPDATE SET client_id=excluded.client_id,secret=excluded.secret,
      transaction_secret=excluded.transaction_secret,generation=generation+1,enabled=0,tested=0,test_session_id=excluded.test_session_id`)
      .bind(parsed.data.clientId,secret,transaction,operator.fence.sessionId),
    db.prepare("DELETE FROM oa_identity_providers WHERE provider_id='google'"),
    db.prepare("DELETE FROM oa_identity_provider_health WHERE provider_id='google' OR provider_id LIKE 'exchange:google:%'"),
    ...audit(ctx,'signin.google.configured','google','Google sign-in',null,{configured:true}),
  ])
  return readGoogleSettings(env,request)
}
export async function enableGoogle(env:WorkerBindings,request:Request,body:unknown) {
  const {operator,db}=await googleOwner(env,request)
  const parsed=z.object({enabled:z.boolean()}).strict().safeParse(body)
  if(!parsed.success) throw new AuthError('invalid_input',400)
  const row=await googleConfiguration(db)
  if(!row || parsed.data.enabled && !row.tested) throw new AuthError('google_test_required',409)
  if(row.enabled!==Number(parsed.data.enabled)) {
    const ctx=await administrationContext(db,operator.id)
    await db.batch([
      db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_google_configuration WHERE generation=? AND (?=0 OR tested=1)) THEN 1 ELSE json('google configuration changed') END").bind(row.generation,Number(parsed.data.enabled)),
      db.prepare('UPDATE vector_google_configuration SET enabled=?,generation=generation+1 WHERE singleton=1').bind(Number(parsed.data.enabled)),
      ...audit(ctx,parsed.data.enabled?'signin.google.enabled':'signin.google.disabled','google','Google sign-in',null,{enabled:parsed.data.enabled}),
    ])
  }
  return readGoogleSettings(env,request)
}
export async function googleSecrets(env:WorkerBindings,row:GoogleConfiguration) {
  return {clientSecret:await openSecret(env,'google-client',row.secret),transactionSecret:await openSecret(env,'google-transaction',row.transaction_secret)}
}
