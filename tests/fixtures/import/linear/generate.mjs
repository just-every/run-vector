// Deterministic synthetic Linear workspace: the documented workspace issue CSV
// (https://linear.app/docs/exporting-data) and the matching API enrichment file
// described in docs/LINEAR-API-FILE.md. No real account data; same seed, same bytes.
export const linearColumns = ['ID','Team','Title','Description','Status','Estimate','Priority','Project ID','Project','Creator','Assignee','Labels','Cycle Number','Cycle Name','Cycle Start','Cycle End','Created','Updated','Started','Triaged','Completed','Canceled','Archived','Due Date','Parent issue','Initiatives','Project Milestone ID','Project Milestone','SLA Status'];
const words = 'migrate queue webhook latency billing export search index cache retry schema invoice onboarding mobile layout keyboard focus audit token report import cycle sprint label owner review draft metric alert deploy rollback'.split(' ');
const statuses = [['Backlog',3],['Todo',4],['In Progress',3],['In Review',1],['Done',6],['Canceled',1]];
const priorities = ['No priority','Urgent','High','Medium','Low'];

function random(seed) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const field = value => /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
const iso = ms => new Date(ms).toISOString();

/**
 * teams: [{key,name,cycles:[name]}]; people: assignee display names that exist
 * as Vector operators; strangers: names that do not. Returns the CSV text, the
 * parsed rows and the API file object.
 */
export function generateLinearWorkspace({ issues = 2000, seed = 20261012, teams, people, strangers = [], labels = [], projects = [], duplicates = 0 }) {
  const next = random(seed), pick = list => list[Math.floor(next() * list.length)];
  const weighted = statuses.flatMap(([name, weight]) => Array(weight).fill(name));
  const counters = new Map(teams.map(team => [team.key, 0])), rows = [], api = [];
  const start = Date.parse('2025-01-06T09:00:00.000Z');
  for (let index = 0; index < issues; index++) {
    const team = teams[index % teams.length], number = counters.get(team.key) + 1;
    counters.set(team.key, number);
    const id = `${team.key}-${number}`, created = start + index * 3_600_000 + Math.floor(next() * 3_000_000);
    const updated = created + Math.floor(next() * 40 * 86_400_000), status = index >= issues - duplicates ? 'Duplicate' : pick(weighted);
    const terminal = ['Done','Canceled','Duplicate'].includes(status);
    const title = `${pick(words)} ${pick(words)} ${pick(words)} ${number}`;
    const lines = Array.from({ length: Math.floor(next() * 10) }, () => Array.from({ length: 8 + Math.floor(next() * 36) }, () => pick(words)).join(' '));
    const description = (next() < 0.1 ? 'Customer said "it\'s slow", café, naïve — ' : '') + lines.join('\n');
    const assignee = next() < 0.25 ? '' : strangers.length && next() < 0.04 ? pick(strangers) : pick(people);
    const cycle = team.cycles.length && next() < 0.5 ? pick(team.cycles) : '';
    const sameTeam = rows.filter(row => row.Team === team.name);
    const parent = sameTeam.length > 5 && next() < 0.12 ? pick(sameTeam.slice(-40)).ID : '';
    const row = {
      ID: id, Team: team.name, Title: title, Description: description, Status: status,
      Estimate: next() < 0.6 ? String(1 + Math.floor(next() * 8)) : '', Priority: pick(priorities),
      'Project ID': '', Project: projects.length && next() < 0.4 ? pick(projects) : '', Creator: pick([...people, ...strangers]),
      Assignee: assignee, Labels: labels.length && next() < 0.5 ? [...new Set([pick(labels), pick(labels)])].join(', ') : '',
      'Cycle Number': cycle ? String(1 + team.cycles.indexOf(cycle)) : '', 'Cycle Name': cycle, 'Cycle Start': '', 'Cycle End': '',
      Created: iso(created), Updated: iso(updated), Started: status === 'In Progress' ? iso(created + 3_600_000) : '', Triaged: '',
      Completed: status === 'Done' ? iso(updated) : '', Canceled: status === 'Canceled' ? iso(updated) : '',
      Archived: terminal && next() < 0.05 ? iso(updated + 86_400_000) : '', 'Due Date': next() < 0.15 ? iso(updated + 7 * 86_400_000).slice(0, 10) : '',
      'Parent issue': parent, Initiatives: '', 'Project Milestone ID': '', 'Project Milestone': '', 'SLA Status': next() < 0.1 ? 'Breached' : '',
    };
    rows.push(row);
    const comments = Array.from({ length: Math.floor(next() * 3) }, (_, n) => ({ body: `Comment ${n + 1} on ${id}: ${pick(words)} ${pick(words)}.`, createdAt: iso(created + (n + 1) * 7_200_000), user: { displayName: pick([...people, ...strangers]) } }));
    const attachments = next() < 0.2 ? [{ title: `Design note for ${id}`, url: `https://docs.example.com/${team.key.toLowerCase()}/${number}` }] : [];
    const relations = [];
    if (status === 'Duplicate') relations.push({ type: 'duplicate', relatedIssue: { identifier: sameTeam[index % sameTeam.length].ID } });
    else if (sameTeam.length > 10 && next() < 0.08) relations.push({ type: next() < 0.7 ? 'blocks' : 'related', relatedIssue: { identifier: pick(sameTeam.slice(-30)).ID } });
    api.push({ identifier: id, parent: parent ? { identifier: parent } : null, comments: { nodes: comments }, attachments: { nodes: attachments }, relations: { nodes: relations } });
  }
  const csv = [linearColumns.join(','), ...rows.map(row => linearColumns.map(column => field(row[column])).join(','))].join('\n') + '\n';
  return { csv, rows, api: { issues: api } };
}
