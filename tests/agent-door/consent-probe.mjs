import { randomUUID } from 'node:crypto';
import { accessToken, autonomousPolicy, policyEnvelope } from '../../node_modules/@runeditrun/rer/modules/agent-door/conformance/crypto.mjs';

/** Saved native arguments enter the real embedded door; no production test route. */
export async function consentProbe({ request, origin, surface, signer, person, db, invoke }) {
  const session = await (await request(origin + '/api/session', { headers: { Cookie: person.cookie } })).json();
  const metadata = await (await request(origin + '/api/metadata', { headers: { Cookie: person.cookie } })).json();
  const state = await db.prepare("SELECT json_extract(envelope,'$.seq') AS seq,json_extract(envelope,'$.revision') AS revision FROM agent_door_state WHERE id=1").first();
  const context = { origin, surface, signer, person, business: 'rer-agent-conformance', consent: randomUUID(), agentId: randomUUID(), seq: state?.seq ?? 0, revision: state?.revision ?? 0 };
  const adopt = async options => {
    const envelope = await policyEnvelope(context, autonomousPolicy(), options);
    const response = await request(origin + '/api/rer/agent-policy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ policy: envelope.policy }) });
    if (!response.ok) throw new Error('Consent probe policy adoption failed');
    await response.body?.cancel(); context.seq = envelope.payload.seq; context.revision = envelope.payload.revision;
  };
  await adopt();
  const tool = surface.tools.find(tool => tool.name === 'vector.issue.creation');
  const who = { person: { id: session.operatorId }, agent: { id: context.agentId, name: 'Agent door conformance', specialist: surface.specialist },
    scopes: [tool.scope], clientId: 'rer-agent-conformance', consent: context.consent };
  const count = () => db.prepare('SELECT count(*) AS n FROM issues').first('n');
  const call = async (name, args, credential) => {
    const response = await request(origin + '/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + credential,
      'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-11-25' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
    await response.body?.cancel(); return response.status;
  };
  const scoped = await call('vector.issues.list', {}, await accessToken(context, { scope: 'issues:read' }));
  const insufficient = await call(tool.name, { teamId: metadata.teams[0].id, title: 'A scope refusal', idempotency_key: randomUUID() },
    await accessToken(context, { scope: 'metadata:read' }));
  const unknown = await call('vector.issues.list', {}, await accessToken(context, { sub: randomUUID(), email: person.email }));
  const counts = () => db.prepare('SELECT (SELECT count(*) FROM projects)+(SELECT count(*) FROM issues) AS n').first('n');
  const beforeInvalid = await counts();
  const invalidCodes = [];
  for (const [name, args] of [
    ['vector.proj.project_record', { name: 'Invalid native icon', leadOperatorId: session.operatorId, icon: 'not an emoji' }],
    ['vector.intake.intake_creation', { teamId: metadata.teams[0].id, title: 'Invalid native measurement key', measurements: { '': 1 } }],
  ]) {
    const response = await request(origin + '/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + await accessToken(context),
      'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-11-25' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { ...args, idempotency_key: randomUUID() } } }) });
    const body = await response.json(); invalidCodes.push(body.result?._meta?.['com.runeditrun/error']?.code);
  }
  const nativeArguments = invalidCodes.every(code => code === 'invalid_arguments') && beforeInvalid === await counts();
  const missing = await request(origin + '/mcp', { method: 'POST', headers: {
    Authorization: 'Bearer ' + await accessToken(context), 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-11-25' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'vector://issues/' + randomUUID() } }) });
  const resourceError = (await missing.json()).error?.data;
  const resourceRefusal = resourceError?.code;
  const resourceCapability = resourceError?.capability;
  const minted = await request(origin + '/api/settings/integrations/tokens', { method: 'POST',
    headers: { Cookie: person.cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Purpose separation probe', scopes: ['issues:read'] }) });
  if (!minted.ok) throw new Error('Native API token purpose fixture failed');
  const personal = await minted.json();
  const personalMcp = await call('vector.issues.list', {}, personal.token);
  const api = await request(origin + '/api/v1/issues', { headers: { Authorization: 'Bearer ' + personal.token } });
  const personalApi = api.status; await api.body?.cancel();
  const revoked = await request(origin + '/api/settings/integrations/tokens/' + personal.credential.id, { method: 'DELETE', headers: { Cookie: person.cookie, Origin: origin } });
  if (!revoked.ok) throw new Error('Native API token cleanup failed');
  await revoked.body?.cancel();
  const job = () => JSON.parse(JSON.stringify({ name: tool.name, args: { teamId: metadata.teams.find(team => team.canRead !== false).id,
    title: 'Investigate retained native work', idempotency_key: randomUUID() }, who }));
  const before = await count(), first = job(), live = await invoke(first.name, first.args, first.who), afterLive = await count();
  const replay = await invoke(first.name, first.args, first.who), afterReplay = await count();
  const conflict = await invoke(first.name, { ...first.args, title: 'Changed retained native work' }, first.who);
  const durable = await db.prepare(`SELECT operation_id,idempotency_key,scopes_json,client_id
    FROM vector_agent_activity_attribution WHERE operation_id=? LIMIT 1`).bind(live.decision?.id).first();
  const durableIdentity = durable?.idempotency_key === first.args.idempotency_key
    && durable.client_id === who.clientId && JSON.stringify(JSON.parse(durable.scopes_json)) === JSON.stringify(who.scopes);
  const created = live.result;
  const targetCall = await invoke('vector.issue.priority', { identifier: created.identifier,
    input: { expectedVersion: created.version, priority: 'high' }, idempotency_key: randomUUID() }, who);
  const targetAudit = await db.prepare('SELECT row FROM agent_door_audit WHERE id=?').bind(targetCall.decision?.id).first('row');
  const nativeTarget = targetCall.outcome === 'done' && JSON.stringify(JSON.parse(targetAudit).resource) === JSON.stringify({ kind: 'issue', id: created.id });
  const saved = job();
  const token = await accessToken(context);
  await adopt({ revoked: { agents: [], consents: [context.consent] } });
  const refused = await invoke(saved.name, saved.args, saved.who), afterRevoked = await count();
  const mcp = await request(origin + '/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: saved.name, arguments: saved.args } }) });
  await mcp.body?.cancel();
  return { ok: nativeTarget && resourceRefusal === 'capability_not_declared' && resourceCapability === 'resources' && nativeArguments && scoped === 200 && insufficient === 403 && unknown === 401 && personalMcp === 401 && personalApi === 200
      && live.outcome === 'done' && afterLive === before + 1 && replay.outcome === 'done' && afterReplay === afterLive && conflict.code === 'idempotency_conflict' && durableIdentity && refused.code === 'consent_revoked' && afterRevoked === afterLive && mcp.status === 401,
    scoped, insufficient, resourceRefusal, resourceCapability, unknownSponsorWithOwnerEmail: unknown, personalMcp, personalApi, nativeArgumentRefusals: invalidCodes, nativeArguments,
    before, afterLive, afterReplay, afterRevoked, durableIdentity, nativeTarget, changedArguments: conflict.code, refused: refused.code, mcpStatus: mcp.status, queuedNativePath: 'undeclared queued lifecycle and mail edges; refuses before native outbox work' };
}
