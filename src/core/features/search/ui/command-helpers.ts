export type ShortcutAction =
  | 'open-palette'
  | 'new-issue'
  | 'go-current'
  | 'go-my-work'
  | 'go-projects'
  | 'await-go'
  | null

export function isEditableTarget(
  target: { tagName?: unknown; isContentEditable?: unknown } | null | undefined,
) {
  if (!target) return false
  if (target.isContentEditable === true) return true
  const tagName =
    typeof target.tagName === 'string' ? target.tagName.toLowerCase() : ''
  return ['input', 'textarea', 'select'].includes(tagName)
}

export function globalShortcut(input: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  editable: boolean
  awaitingGo: boolean
}): ShortcutAction {
  if (input.editable || input.altKey) return null
  const key = input.key.toLowerCase()
  if ((input.metaKey || input.ctrlKey) && key === 'k') return 'open-palette'
  if (input.metaKey || input.ctrlKey) return null
  if (input.awaitingGo) {
    if (key === 'm') return 'go-my-work'
    if (key === 'c') return 'go-current'
    if (key === 'p') return 'go-projects'
    return key === 'g' ? 'await-go' : null
  }
  if (key === 'g') return 'await-go'
  if (key === 'c') return 'new-issue'
  return null
}

export function movePaletteHighlight(
  current: number,
  direction: 'next' | 'previous',
  count: number,
) {
  if (count === 0) return -1
  if (direction === 'next') return current >= count - 1 ? 0 : current + 1
  return current <= 0 ? count - 1 : current - 1
}
