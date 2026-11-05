import type { DroppedCopyValue } from '../issue-copy/schema'
import { namedDefinitions, type FieldValues } from './validation'

/** ISSUE-023 for typed team fields: a copy that stays in the field's team keeps the
 * same definition and option identity; a copy into another team drops the value
 * and reports it, since that team has no such field. Untyped legacy keys keep
 * their workspace-wide identity mapping. */
export async function mapCopiedFieldValues(db: D1Database, identifier: string, values: FieldValues, teamId: string) {
  const { definitions, options } = await namedDefinitions(db, Object.keys(values))
  const mapped: FieldValues = {}, checked: Record<string, string> = {}
  const mappings: { from: string; to: string | null }[] = [], dropped: DroppedCopyValue[] = []
  for (const [key, value] of Object.entries(values)) {
    const definition = definitions.find(row => row.id === key)
    const option = definition && options.find(row => row.field_id === key && row.id === value)
    if (!definition || (definition.team_id === teamId && option)) {
      mapped[key] = value
      if (option) checked[key] = option.id
      mappings.push({ from: key, to: key })
      continue
    }
    mappings.push({ from: key, to: null })
    dropped.push({
      identifier, field: `customFields.${key}`, value,
      reason: definition.team_id === teamId
        ? `The original ${definition.name} option is unavailable.`
        : `The destination team has no ${definition.name} field; ${option ? option.name : 'its value'} stays on the original issue only.`,
    })
  }
  return { values: mapped, checked, mappings, dropped }
}
