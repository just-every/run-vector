import { buildVectorSample } from '../sample-data/vector'
import type { WorkerBindings } from './core/app/bindings'
import { bootstrapWorkspace } from './core/features/bootstrap/repository'
import { insertSampleData } from './core/features/sample-data/repository'
import { sampleDataSchema } from './core/features/sample-data/schema'

/** Real owner admission precedes this hook. Sample sessions never enter demo storage. */
export async function seedDemo(env: WorkerBindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
  if (env.RER_DEMO !== '1') throw new Error('Demo data requires demo mode.')
  await bootstrapWorkspace(env.DB, env, now)
  const owner = await env.DB.prepare(`SELECT o.id, o.workspace_id FROM operators o
    JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id
    WHERE lower(o.email)=? AND o.removed_at IS NULL AND a.status='active'`)
    .bind(ownerEmail.toLowerCase()).first<{ id: string; workspace_id: string }>()
  if (!owner) throw new Error('Demo owner has not been admitted.')

  const sample = buildVectorSample(now)
  const ids = new Map<string, string>([[sample.workspace.id, owner.workspace_id], [sample.operators[0].id, owner.id]])
  // Keep an existing bootstrap team if its prefix is one of the sample teams.
  for (const team of sample.teams) {
    const existing = await env.DB.prepare('SELECT id FROM teams WHERE workspace_id=? AND identifier_prefix=?')
      .bind(owner.workspace_id, team.identifierPrefix).first<{ id: string }>()
    if (!existing) continue
    ids.set(team.id, existing.id)
    const statuses = await env.DB.prepare('SELECT id,category FROM workflow_statuses WHERE team_id=?')
      .bind(existing.id).all<{ id: string; category: string }>()
    for (const status of sample.workflowStatuses.filter(row => row.teamId === team.id)) {
      const match = statuses.results.find(row => row.category === status.category)
      if (match) ids.set(status.id, match.id)
    }
  }
  const data = sampleDataSchema.parse(JSON.parse(JSON.stringify(sample), (_key, value) =>
    typeof value === 'string' ? ids.get(value) ?? value : value))
  data.sessions = []
  // The owner already exists with their own name and email; retain that identity.
  data.operators = data.operators.filter(operator => operator.id !== owner.id)
  await insertSampleData(env.DB, data)
  await env.DB.prepare(`UPDATE workspace_installation SET setup_completed_at=COALESCE(setup_completed_at,?),updated_at=?
    WHERE workspace_id=? AND setup_operator_id=?`).bind(now.toISOString(), now.toISOString(), owner.workspace_id, owner.id).run()
}
