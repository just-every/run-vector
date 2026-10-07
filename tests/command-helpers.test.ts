import assert from 'node:assert/strict'
import test from 'node:test'
import {
  globalShortcut,
  isEditableTarget,
  movePaletteHighlight,
} from '../src/core/features/search/ui/command-helpers.ts'
import { paletteEntries } from '../src/core/features/search/ui/data.ts'

test('global shortcuts honour editable targets and G sequences', () => {
  assert.equal(
    globalShortcut({
      key: 'k',
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      editable: false,
      awaitingGo: false,
    }),
    'open-palette',
  )
  assert.equal(
    globalShortcut({
      key: 'c',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      editable: false,
      awaitingGo: false,
    }),
    'new-issue',
  )
  assert.equal(
    globalShortcut({
      key: 'g',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      editable: false,
      awaitingGo: false,
    }),
    'await-go',
  )
  assert.equal(
    globalShortcut({
      key: 'p',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      editable: false,
      awaitingGo: true,
    }),
    'go-projects',
  )
  assert.equal(
    globalShortcut({
      key: 'c',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      editable: true,
      awaitingGo: false,
    }),
    null,
  )
  assert.equal(isEditableTarget({ tagName: 'TEXTAREA' }), true)
  assert.equal(isEditableTarget({ isContentEditable: true }), true)
})

test('palette highlight wraps and only produces real navigable records', () => {
  assert.equal(movePaletteHighlight(2, 'next', 3), 0)
  assert.equal(movePaletteHighlight(0, 'previous', 3), 2)
  const entries = paletteEntries(
    {
      issues: [
        {
          id: 'issue-1',
          identifier: 'FLW-842',
          title: 'Webhook delivery retries',
        },
      ],
      projects: [{ id: 'project-1', name: 'Customer Reliability' }],
      savedViews: [
        { id: 'view-1', name: 'Unavailable surface', isShared: true },
      ],
    },
    'reliability',
  )
  assert.deepEqual(
    entries.map((entry) => entry.group),
    ['Issues', 'Projects'],
  )
  assert.ok(entries.every((entry) => entry.destination !== undefined))
  assert.equal(entries[1]?.destination, '/app/projects/$projectId')
})
