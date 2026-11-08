import { SettingsError } from '../settings/repository'

type Stored = { id: string; name: string; position: number }

/** Option identity is permanent: existing options keep their id and order, a
 * rename changes only the name, and new options go last. Removing, archiving and
 * reordering options are not offered yet. */
export function planOptions(stored: Stored[], requested: { id?: string; name: string }[]) {
  const kept = requested.slice(0, stored.length)
  if (kept.length !== stored.length || kept.some((option, index) => option.id !== stored[index]!.id) || requested.slice(stored.length).some(option => option.id))
    throw new SettingsError('invalid_request', 'Keep every existing option in its current order and add new options last.', 400)
  const next = Math.max(-1, ...stored.map(option => option.position)) + 1
  return {
    renamed: stored.flatMap((option, index) => kept[index]!.name === option.name ? [] : [{ id: option.id, from: option.name, to: kept[index]!.name }]),
    added: requested.slice(stored.length).map((option, index) => ({ name: option.name, position: next + index })),
  }
}
