import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

test('only feature repositories create Drizzle D1 clients', async () => {
  const files = await sourceFiles(join(process.cwd(), 'src', 'core'))
  const clientImporters = await Promise.all(files.map(async (file) => ({ file, source: await readFile(file, 'utf8') })))
  const violations = clientImporters
    .filter(({ source }) => source.includes("from 'drizzle-orm/d1'"))
    .map(({ file }) => file)
    .filter((file) => !file.endsWith('/repository.ts'))
  assert.deepEqual(violations, [])
})

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const children = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : []
  }))
  return children.flat()
}
