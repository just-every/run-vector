import { it } from 'vitest'
import { severityDefinitions, severityValues } from './custom-fields-journey'
import { severityArchive, severityWriters } from './custom-fields-writers'
import { roleWorkspace } from './role-fixture'

it('[FIELD-001 ISSUE-023 ROLE-001 ROLE-009] a team Severity field is defined by its team owners, set through the browser door, /api/v1, templates and the agent tool, refuses other values, renames without moving stored identity, copies by destination and survives an archive round-trip', async () => {
  const w = await roleWorkspace()
  const fields = await severityDefinitions(w)
  const values = await severityValues(w, fields)
  const created = await severityWriters(w, fields.severity, fields.other, values.issue, values.legacy)
  await severityArchive(w, [values.issue.id, created.id])
}, 240_000)
