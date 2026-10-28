import { randomUUID } from 'node:crypto';
import { accessToken, autonomousPolicy, policyEnvelope } from '../../vendor/base/agent-door/conformance/crypto.mjs';

/** Saved native arguments enter the real embedded door; no production test route. */
export async function consentProbe({ request, origin, surface, signer, person, db, invoke }) {
  const session = await (await request(origin + '/api/session', { headers: { Cookie: person.cookie } })).json();
  const metadata = await (await request(origin + '/api/metadata', { headers: { Cookie: person.cookie } })).json();
  const state = await db.prepare("SELECT json_extract(envelope,'$.seq') AS seq,json_extract(envelope,'$.revision') AS revision FROM agent_door_state WHERE id=1").first();
  const context = { origin, surface, signer, person, business: 'rer-agent-conformance', consent: randomUUID(), agentId: randomUUID(), seq: state.seq, revision: state.revision };
  const adopt = async options => {
    const envelope = await policyEnvelope(context, autonomousPolicy(), options);
    const response = await request(origin + '/api/rer/agent-policy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ policy: envelope.policy }) });
    if (!response.ok) throw new Error('Consent probe policy adoption failed');
    await response.body?.cancel(); context.seq = envelope.payload.seq; context.revision = envelope.payload.revision;
  };
  await adopt();
  const tool = surface.tools.find(tool => tool.name === 'vector.issue.creation');
  const who = { person: { id: session.operatorId }, agent: { id: context.agentId, name: 'Delivery agent', specialist: surface.specialist },
    scopes: [tool.scope], clientId: 'native-delivery-worker', consent: context.consent };
  const count = () => db.prepare('SELECT count(*) AS n FROM issues').first('n');
  const job = () => JSON.parse(JSON.stringify({ name: tool.name, args: { teamId: metadata.teams.find(team => team.canRead !== false).id,
    title: 'Investigate retained native work', idempotency_key: randomUUID() }, who }));
  const before = await count(), first = job(), live = await invoke(first.name, first.args, first.who), afterLive = await count();
  const saved = job();
  const token = await accessToken(context);
  await adopt({ revoked: { agents: [], consents: [context.consent] } });
  const refused = await invoke(saved.name, saved.args, saved.who), afterRevoked = await count();
  const mcp = await request(origin + '/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: saved.name, arguments: saved.args } }) });
  await mcp.body?.cancel();
  return { ok: live.outcome === 'done' && afterLive === before + 1 && refused.code === 'consent_revoked' && afterRevoked === afterLive && mcp.status === 401,
    before, afterLive, afterRevoked, refused: refused.code, mcpStatus: mcp.status, queuedNativePath: 'pending hooks-7 durable operation context' };
}
