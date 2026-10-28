#!/usr/bin/env node
// Seed-owned incremental documentation generator. Base's parser remains authoritative.
import { readFile, writeFile } from 'node:fs/promises'
import { parseContract } from '../src/base/seed-contract.mjs'

const [mode, ...ids] = process.argv.slice(2)
if (!['write', 'check'].includes(mode) || !ids.length || new Set(ids).size !== ids.length) {
  throw new Error('Usage: node scripts/contract-docs.mjs <write|check> CLAUSE... (unique clause IDs required)')
}
const paths = ['CONTRACT.md', 'ACCEPTANCE.md', 'docs/CLAIMS.md']
const original = await Promise.all(paths.map(path => readFile(path, 'utf8')))
const cells = line => line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(s => s.trim())
const statusStart = original[0].indexOf('\n## Status\n')
if (statusStart < 0) throw new Error('Missing CONTRACT Status section')
const statusLines = original[0].slice(statusStart).split('\n')
const table = statusLines.findIndex(line => cells(line).join('|') === 'Clause|Title|Kind|Status|Evidence|Gap')
if (table < 0) throw new Error('Missing CONTRACT Status table')
const rows = []
for (let i = table + 2; i < statusLines.length && statusLines[i].startsWith('|'); i++) {
  const row = cells(statusLines[i])
  if (row.length !== 6) throw new Error(`Malformed Status row: ${statusLines[i]}`)
  rows.push(row)
}
function count(kinds) {
  const selected = rows.filter(row => kinds.includes(row[2]))
  return ['done', 'partial', 'missing'].map(status => selected.filter(row => row[3] === status).length).concat(selected.length)
}
function summaries(text) {
  return text.replace(/(^\|\s*Clauses\s*\|\s*Done\s*\|\s*Partial\s*\|\s*Missing\s*\|\s*Total\s*\|[ \t]*\n\|[^\n]*\|[ \t]*\n)((?:\|[^\n]*\|[ \t]*\n)+)/gm, (_, header, body) => {
    const updated = body.replace(/^\|\s*([^|]+?)\s*\|[^\n]*$/gm, (line, label) => {
      const name = label.trim().toLowerCase()
      const selected = name === 'all' || name === 'total' ? ['published', 'target', 'push-further'] : name.split(/\s*,\s*|\s+and\s+/).map(s => s === 'push further' ? 'push-further' : s)
      if (!selected.every(s => ['published', 'target', 'push-further'].includes(s))) throw new Error(`Unknown summary row: ${label}`)
      return `| ${label.trim()} | ${count(selected).join(' | ')} |`
    })
    return header + updated
  })
}
const contract = summaries(original[0])
const parsed = parseContract(contract)
let acceptance = summaries(original[1]), claims = original[2]
for (const id of ids) {
  const clause = parsed.clauses.find(c => c.id === id)
  if (!clause) throw new Error(`Unknown clause: ${id}`)
  const row = rows.find(r => r[0].replace(/`/g, '') === id)
  const match = /\*{1,2}Acceptance:\*{1,2}\s*([\s\S]*?)(?=\s*\*{1,2}(?:Status|Gap):\*{1,2}|$)/i.exec(clause.text)
  if (!match?.[1].trim()) throw new Error(`${id} has no extractable acceptance`)
  const evidence = row[4] ? ` Evidence: ${row[4].replace(/\.$/, '')}.` : ''
  const gap = row[5] ? ` Gap: ${row[5].replace(/\.$/, '')}.` : ''
  const entry = `- **${id} — ${clause.title}** (${clause.status}).${evidence}${gap} Acceptance: ${match[1].trim()}`
  const pattern = new RegExp(`^- \\*\\*${id} — [^\\n]*$`, 'gm')
  if ((acceptance.match(pattern) ?? []).length !== 1) throw new Error(`${id} must have exactly one ACCEPTANCE entry`)
  acceptance = acceptance.replace(pattern, () => entry)
  const claim = `| ${id} | ${clause.status} | ${row[5] || 'See CONTRACT.md for the full clause.'} | ${row[4]} |`
  const claimPattern = new RegExp(`^\\|\\s*${id}\\s*\\|[^\\n]*$`, 'gm')
  const n = (claims.match(claimPattern) ?? []).length
  if (n > 1) throw new Error(`${id} has duplicate CLAIMS rows`)
  claims = n ? claims.replace(claimPattern, () => claim) : claims.trimEnd() + `\n${claim}\n`
}
const output = [contract, acceptance, claims]
if (mode === 'check') {
  const stale = paths.filter((_, i) => original[i] !== output[i])
  if (stale.length) throw new Error(`Generated documentation out of date: ${stale.join(', ')}`)
  console.log(`Contract parser and generated documentation are current for ${ids.join(', ')}.`)
} else {
  for (let i = 0; i < paths.length; i++) if (original[i] !== output[i]) await writeFile(paths[i], output[i])
  console.log(`Synchronized ${ids.join(', ')} and summary counts.`)
}
