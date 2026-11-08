import { expect } from 'vitest'
import { type roleWorkspace, resetLimits } from './role-fixture'
import { json, refused } from './custom-fields-journey'

/** Undo restores the type and its paired field map, while a later requirement
 * cannot be bypassed by replaying an older native Undo receipt. */
export async function typedUndoJourney(w: Awaited<ReturnType<typeof roleWorkspace>>) {
  const { owner } = w.people
  const state = await json(owner.call('/settings/teams', 'POST', { name: 'synthetic-vector-typed-undo', identifierPrefix: 'TYPEUNDO' }))
  const team = state.teams.find((row: any) => row.identifierPrefix === 'TYPEUNDO')
  const fieldState = await json(owner.call(`/settings/teams/${team.id}/custom-fields`, 'POST', {
    name: 'Severity', type: 'single_select', options: [{ name: 'Minor' }, { name: 'Major' }],
  }))
  const field = fieldState.teams.find((row: any) => row.id === team.id).customFields[0]
  const types = await json(owner.call(`/settings/teams/${team.id}/issue-types`, 'PUT', { enabled: true }))
  const bug = types.types.find((row: any) => row.defaultKey === 'bug')
  const feature = types.types.find((row: any) => row.defaultKey === 'feature')
  const task = types.types.find((row: any) => row.defaultKey === 'task')
  const original = await json(owner.call('/issues', 'POST', {
    title: 'synthetic-vector-typed-undo', teamId: team.id, issueTypeId: bug.id, customFields: { [field.id]: field.options[0].id },
  }), 201)
  const changed = await owner.call('/issues/' + original.identifier, 'PATCH', {
    expectedVersion: original.version, issueTypeId: feature.id, customFields: {},
  })
  await json(changed.clone())
  const receipt = JSON.parse(changed.headers.get('x-vector-undo')!)
  expect(receipt.actionId).toBeTruthy()
  await json(owner.call('/issues/undo', 'POST', { actionId: receipt.actionId }))
  const restored = await json(owner.call('/issues/' + original.identifier))
  expect(restored).toMatchObject({ issueTypeId: bug.id, customFields: original.customFields, version: original.version + 2 })
  expect(restored.activity.filter((row: any) => row.nextValue?.undoOf === receipt.actionId)).toHaveLength(1)
  await refused(() => owner.call('/issues/undo', 'POST', { actionId: receipt.actionId }), 409, 'replaying a typed Undo')

  const optional = await json(owner.call('/issues', 'POST', { title: 'synthetic-vector-later-requirement', teamId: team.id, issueTypeId: feature.id }), 201)
  const moved = await owner.call('/issues/' + optional.identifier, 'PATCH', { expectedVersion: optional.version, issueTypeId: task.id })
  await json(moved.clone())
  const previous = JSON.parse(moved.headers.get('x-vector-undo')!)
  await json(owner.call(`/settings/teams/${team.id}/issue-types/${feature.id}`, 'PATCH', { expectedVersion: feature.version, requiredFieldIds: [field.id] }))
  await refused(() => owner.call('/issues/undo', 'POST', { actionId: previous.actionId }), 409, 'Undo cannot clear a newly required Severity')
  const current = await json(owner.call('/issues/' + optional.identifier))
  expect(current).toMatchObject({ issueTypeId: task.id, customFields: {}, version: optional.version + 1 })
  expect(current.activity.some((row: any) => row.nextValue?.undoOf === previous.actionId)).toBe(false)
  await resetLimits()
}
