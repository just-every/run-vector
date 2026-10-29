/** Shared transport routes are permission doors with their own native identity
 * classes. Tool effects still use the ordinary role-matrix rows in native.ts. */
export const agentDoorRoutes = [
  { path: '/mcp', identity: 'agent.owner-bound', authority: 'Signed Business token, current native sponsor, scopes, consent and policy; discovery is public.' },
  { path: '/.well-known/oauth-protected-resource', identity: 'public.metadata', authority: 'Public canonical resource metadata; no installation records.' },
  { path: '/.well-known/oauth-protected-resource/mcp', identity: 'public.metadata', authority: 'Public canonical resource metadata; no installation records.' },
  { path: '/api/rer/agent-policy', identity: 'business.signed-policy', authority: 'Installation-bound signed policy, audience, sequence and native Business people.' },
  { path: '/agents', identity: 'person.session', authority: 'Current native person; Business roles and private approval visibility.' },
  { path: '/agents/approvals/:id', identity: 'person.session', authority: 'Current native person and named approval visibility.' },
  { path: '/agents/api/state', identity: 'person.session', authority: 'Current Business owner or editor.' },
  { path: '/agents/api/policy', identity: 'person.session', authority: 'Current Business owner, native session and same Origin; paired policy remains signed.' },
  { path: '/agents/api/pause', identity: 'person.session', authority: 'Current Business owner, native session and same Origin.' },
  { path: '/agents/api/audit', identity: 'person.session', authority: 'Current Business owner or editor.' },
  { path: '/agents/api/agents', identity: 'person.session', authority: 'Current Business owner or editor.' },
  { path: '/agents/api/agents/:id/revoke', identity: 'person.session', authority: 'Current Business owner, native session and same Origin.' },
  { path: '/agents/api/approvals', identity: 'person.session', authority: 'Current person and native named-approver visibility.' },
  { path: '/agents/api/approvals/:id', identity: 'person.session', authority: 'Current person and native named-approver visibility.' },
  { path: '/agents/api/approvals/:id/approve', identity: 'person.session', authority: 'Current named approver, same Origin, revision and summary digest.' },
  { path: '/agents/api/approvals/:id/reject', identity: 'person.session', authority: 'Current named approver, same Origin, revision and summary digest.' },
  { path: '/agents/api/reviews', identity: 'person.session', authority: 'Current person and native reviewer visibility.' },
  { path: '/agents/api/reviews/:id', identity: 'person.session', authority: 'Current person and native reviewer visibility.' },
  ...(['reviewed', 'flag', 'undo'] as const).map(action => ({ path: `/agents/api/reviews/:id/${action}`,
    identity: 'person.session' as const, authority: 'Current native reviewer, same Origin and retained decision; Undo requires a real native reversal.' })),
] as const;
