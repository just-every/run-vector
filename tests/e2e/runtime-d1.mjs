// Fixture writes while a Worker is running go through that runtime's own local
// D1 (wrangler's local explorer), so they queue with the Worker's queries. A
// write lock taken on the SQLite file from outside fails every concurrent Worker
// write with D1 "internal error" (evidence: vector-r1 part 0). One script is one
// atomic batch. Reading the file from outside stays safe: WAL readers never block.
const databases = new Map();
async function databaseId(origin) {
  if (!databases.has(origin)) {
    const response = await fetch(origin + "/cdn-cgi/local/explorer/api/d1/database");
    const body = await response.json();
    const found = response.ok && body.success ? body.result.filter((row) => row.name === "DB") : [];
    if (found.length !== 1) throw new Error(`Runtime D1 lookup failed (${response.status}).`);
    databases.set(origin, found[0].uuid);
  }
  return databases.get(origin);
}
// The explorer binds text parameters only, so fixture values (text, numbers,
// null) are written as SQL literals. Fixture SQL holds no literal "?".
const literal = (value) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const inline = ({ sql, params = [] }) => { let index = 0; return sql.replace(/\?/g, () => literal(params[index++])); };
/** `sql` is one script, or an array of statements (text or {sql, params}) written
 * as one atomic batch; D1 bounds each statement, so large fixtures use arrays. */
export async function writeRuntimeD1(origin, sql, params = []) {
  const response = await fetch(`${origin}/cdn-cgi/local/explorer/api/d1/database/${await databaseId(origin)}/raw`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Array.isArray(sql) ? { batch: sql.map((statement) => ({ sql: typeof statement === "string" ? statement : inline(statement) })) } : { sql: inline({ sql, params }) }),
  });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error("Runtime D1 fixture write failed: " + (body.errors?.[0]?.message ?? response.status));
  return body.result;
}
