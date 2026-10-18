// Writes the Linear API file Vector merges with a Linear CSV run (docs/LINEAR-API-FILE.md).
// The owner runs it on their own machine with their own Linear API key in
// LINEAR_API_KEY; the key is never printed, written or sent anywhere but Linear.
// Usage: LINEAR_API_KEY=... node scripts/data/linear-api-file.mjs --team ENG --out /absolute/linear-api.json
import { isAbsolute } from 'node:path';
import { open } from 'node:fs/promises';

const endpoint = process.env.LINEAR_API_URL ?? 'https://api.linear.app/graphql';
const issueFields = `identifier
      sortOrder
      parent { identifier }
      comments(first: 50) { pageInfo { hasNextPage endCursor } nodes { body createdAt user { displayName name } externalUser { name } botActor { name } } }
      attachments(first: 50) { pageInfo { hasNextPage endCursor } nodes { title url } }
      relations(first: 50) { pageInfo { hasNextPage endCursor } nodes { type relatedIssue { identifier } } }`;
export const issuesQuery = `query VectorMoveIn($team: String!, $after: String) {
  issues(first: 25, after: $after, includeArchived: true, filter: { team: { key: { eq: $team } } }) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      ${issueFields}
    }
  }
}`;
const connections = {
  comments: 'nodes { body createdAt user { displayName name } externalUser { name } botActor { name } }',
  attachments: 'nodes { title url }',
  relations: 'nodes { type relatedIssue { identifier } }',
};
const moreQuery = field => `query VectorMoveInMore($id: String!, $after: String) {
  issue(id: $id) { ${field}(first: 50, after: $after) { pageInfo { hasNextPage endCursor } ${connections[field]} } }
}`;

async function graphql(key, query, variables) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: key }, body: JSON.stringify({ query, variables }) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.errors) throw new Error(`Linear answered ${response.status}${body?.errors ? ': ' + body.errors.map(error => error.message).join('; ') : ''}`);
  return body.data;
}
async function main() {
  const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
  const team = option('--team'), out = option('--out'), key = process.env.LINEAR_API_KEY;
  if (!team || !/^[A-Za-z0-9]{1,10}$/.test(team) || !out || !isAbsolute(out)) throw new Error('Usage: --team KEY --out /absolute/file.json');
  if (!key) throw new Error('Set LINEAR_API_KEY to your own Linear API key.');
  const issues = [];
  for (let after = null; ;) {
    const page = (await graphql(key, issuesQuery, { team, after })).issues;
    for (const node of page.nodes) {
      // Follow any connection longer than one page so nothing is cut off.
      for (const field of Object.keys(connections)) {
        for (let info = node[field].pageInfo; info.hasNextPage;) {
          const more = (await graphql(key, moreQuery(field), { id: node.id, after: info.endCursor })).issue[field];
          node[field].nodes.push(...more.nodes);
          info = more.pageInfo;
        }
      }
      issues.push({ identifier: node.identifier, sortOrder: node.sortOrder, parent: node.parent, comments: { nodes: node.comments.nodes }, attachments: { nodes: node.attachments.nodes }, relations: { nodes: node.relations.nodes } });
    }
    process.stderr.write(`read ${issues.length} issues\n`);
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  const file = await open(out, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify({ format: 'vector-linear-api-v1', team, exportedAt: new Date().toISOString(), issues }) + '\n'); }
  finally { await file.close(); }
  console.log(JSON.stringify({ team, issues: issues.length, out }));
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error.message); process.exitCode = 1; });
