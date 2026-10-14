import { createPortabilityHandler, PortabilityError, MAX_LINE_BYTES, canonicalJson, type Staged } from '@runeditrun/rer/modules/portability';
// Base's bounded transport reader; no private restore internals are changed.
// @ts-expect-error The native ESM transport helper has no declarations.
import { boundedJson } from '@runeditrun/rer/modules/portability/http';
import inventory from './archive-inventory.json';
import { portabilityPolicy,archiveImportPolicy } from './archive-policy.mjs';
import { requireOperator, clearSessionCookie } from '../auth/service';
import { mutationDatabase } from '../auth/mutation-database';
import { validateArchiveInventory,validateArchiveAttachments } from './archive-inventory.mjs';
import type { WorkerBindings } from '../../app/bindings';

const bootstrapTables = ['workspace_bootstrap', 'workspace_settings', 'workspace_installation', 'operators', 'oa_operators', 'vector_auth_operators', 'teams', 'workflow_statuses'];
const response = (error: string, status: number) => Response.json({error}, {status, headers:{'Cache-Control':'no-store'}});

/** Forwarding to the object conveys no authority, including for custody/status. */
export async function authenticateRestoreRequest(request: Request, env: WorkerBindings) {
  const actor = await requireOperator(env, request);
  if (!actor) return response('unauthorized', 401);
  if (request.method !== 'GET' && request.headers.get('Origin') !== env.APP_ORIGIN) return response('origin_refused', 403);
  const path = new URL(request.url).pathname;
  const id = path.split('/')[4];
  if (id) {
    const job = await env.DB.prepare('SELECT actor FROM rer_portability_jobs WHERE id=? AND kind=\'import\'').bind(id).first<{actor:string}>();
    if (job?.actor !== actor.id) return response('job_not_found', 404);
  }
  return actor;
}

/** Runs only inside the installation's durable coordinator. Native HTTP admission
 * is repeated here; final publication independently checks SQL authority. */
export async function restoreRequest(request: Request, env: WorkerBindings) {
  const actor=await authenticateRestoreRequest(request,env);
  if(actor instanceof Response)return actor;
  await validateArchiveInventory(env.DB);await validateArchiveAttachments(env.DB,env.FILES);
  const path=new URL(request.url).pathname,id=path.split('/')[4];
  const creating=request.method==='POST' && path==='/api/portability/imports';
  let importPolicy=portabilityPolicy;
  if (creating) {
    try {
      const body=await boundedJson(request,MAX_LINE_BYTES);
      if(body.confirmed!==true || !Array.isArray(body.manifest?.tables))return response('confirmation_required',400);
      importPolicy=archiveImportPolicy(body.manifest);
      const tableNames=body.manifest.tables.map((table:{name:unknown})=>table.name);
      if(tableNames.some((name:unknown)=>typeof name!=='string'||!Object.hasOwn(inventory,name)))return response('table_inventory',400);
      // A create whose job committed but whose reply was lost (a reset, or a
      // transient error Base reports as import_running) left this session's
      // reservation bound to a staging job. Return that job to its own session.
      const bound=await env.DB.prepare(`SELECT j.id,json_extract(j.metadata,'$.manifest') AS manifest FROM vector_http_restore r
        JOIN rer_portability_jobs j ON j.id=r.import_id WHERE j.kind='import' AND j.phase='staging' AND j.actor=r.actor_id
        AND r.actor_id=? AND r.session_id=?`).bind(actor.id,actor.fence.sessionId).first<{id:string;manifest:string}>();
      if(bound && canonicalJson(JSON.parse(bound.manifest))===canonicalJson(body.manifest))return Response.json({id:bound.id},{status:200,headers:{'Cache-Control':'no-store'}});
      const replaceable=[...portabilityPolicy.replaceableTables!,...bootstrapTables];
      const database=mutationDatabase(env.DB, actor.id, actor.fence);
      // Match the staged manifest's entire discovered native graph, including
      // newer product tables. Base independently validates the exact inventory.
      // This transaction refuses an already-reserved upload before acquiring
      // the destination reservation; no preflight-only empty-target decision.
      await database.batch([
        ...tableNames.filter((name:string)=>!replaceable.includes(name)).map((name:string)=>database.prepare(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "${name.replaceAll('"','""')}") THEN 1 ELSE json('restore target not empty') END`)),
        database.prepare(`INSERT INTO vector_http_restore(id,actor_id,auth_id,session_id,source_token_id,operator_version)
          SELECT 1,?,s.operator_id,s.id,s.source_token_id,s.operator_version FROM oa_sessions s WHERE s.id=?`).bind(actor.id, actor.fence.sessionId),
      ]);
      request=new Request(request.url,{method:request.method,headers:request.headers,body:JSON.stringify(body)});
    } catch (error) {
      if(error instanceof PortabilityError)return response(error.code,error.status);
      return response('restore_bootstrap_not_pristine',409);
    }
  } else if (request.method !== 'GET') {
    if(!id)return response('route_not_found',404);
    const aborting=request.method==='POST' && path.endsWith('/abort');
    const admitted = await env.DB.prepare('SELECT 1 FROM vector_http_restore WHERE import_id=? AND actor_id=? AND (?=1 OR session_id=?)').bind(id, actor.id, aborting?1:0, actor.fence.sessionId).first();
    if (!admitted) return response('restore_admission_required', 409);
  }
  const policy = {...importPolicy,
    replaceableTables:[...portabilityPolicy.replaceableTables!, ...bootstrapTables],
    validateStaged: async (staged:Staged) => {
      if (!(await env.DB.prepare('SELECT 1 FROM vector_http_restore_eligible WHERE id=1').first())) throw new PortabilityError('restore_authority_changed',409);
      // Shared native erasure validation applies to local and HTTP restoration.
      return portabilityPolicy.validateStaged?.(staged);
    },
  };
  try {
    // Raw native bindings are intentionally scoped to the Base engine: its final
    // transaction uses the excluded-table SQL guard. Failure settlement remains
    // possible after revocation and can delete only Base's job-owned objects.
    const handler = await createPortabilityHandler({db:env.DB, buckets:{FILES:env.FILES}, policy, appOrigin:env.APP_ORIGIN,
      authorize:async incoming => (await requireOperator(env,incoming))?.id ?? null});
    const result = await handler(request) ?? response('route_not_found',404);
    if (id && request.method==='POST' && path.endsWith('/finalize') && result.ok) result.headers.set('Set-Cookie',clearSessionCookie(env,request));
    return result;
  } finally {
    // A rejected manifest never acquired a Base job. Release only that unattached
    // reservation, never the authority or an import already staged by Base.
    if (creating) await env.DB.prepare('DELETE FROM vector_http_restore WHERE import_id IS NULL AND session_id=?').bind(actor.fence.sessionId).run();
  }
}
