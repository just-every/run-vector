export type CommandFailure = { identifier: string; reasons: string[] };

export class BulkCommandError extends Error {
  constructor(readonly failures: CommandFailure[]) {
    super("No issues were changed. Resolve the reported issues and try again.");
  }
}

/** Preflight and transaction admission use the same checks. Every admission
 * statement precedes every activity, notification, relation and issue write. */
export function commandValidation<K extends string>(
  db: D1Database,
  sql: string,
  values: (string | number | null)[],
  reasons: Record<K, string>,
) {
  return {
    statement: db.prepare(sql).bind(...values),
    admission: db.prepare(
      `SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM (${sql}) WHERE ${Object.keys(reasons).join(" OR ")}) THEN 1 ELSE json('bulk command admission denied') END`,
    ).bind(...values),
    failures(rows: ({ identifier: string } & Record<K, number>)[]): CommandFailure[] {
      return rows.flatMap((row) => {
        const failures = (Object.entries(reasons) as [K, string][])
          .filter(([key]) => row[key]).map(([, message]) => message);
        return failures.length ? [{ identifier: row.identifier, reasons: failures }] : [];
      });
    },
  };
}

/** Pin the issue identities used to prepare activities as well as their public
 * expected versions. This also protects a same-team no-op's receipt. */
export function selectedSnapshotAdmission(
  db: D1Database,
  rows: { id: string; version: number }[],
) {
  return db.prepare(`SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM json_each(?) r WHERE NOT EXISTS(
      SELECT 1 FROM issues i WHERE i.id=json_extract(r.value,'$.id') AND i.version=json_extract(r.value,'$.version'))
    ) THEN 1 ELSE json('bulk command snapshot changed') END`).bind(JSON.stringify(rows));
}
