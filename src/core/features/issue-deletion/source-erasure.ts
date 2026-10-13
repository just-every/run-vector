import type { D1Sql } from "../../../../vendor/base/import-kit/src/d1/index";
import { erasedStoredSourceIdentity } from "../integrations/source-identity";
import {
  storedValueSql,
  restoreValueSql,
  type StoredValue,
} from "../../shared/sql/stored-value";

/** The scalar D1 read path replaces malformed UTF-8. Capture source keys as
 * typed bytes and reconstruct them inside SQLite for every predicate/write. */
export async function sourceErasure(
  db: D1Database,
  issueId: string,
): Promise<D1Sql[]> {
  const writes: D1Sql[] = [];
  for (const table of ["vector_source_records", "vector_source_receipts"]) {
    const columns = [
      "source_id",
      "record_id",
      ...(table === "vector_source_receipts" ? ["revision_id"] : []),
    ];
    const rows = (
      await db
        .prepare(
          `SELECT erased,${columns.map((name) => storedValueSql(name) + " AS " + name).join(",")} FROM ${table} WHERE issue_id=?`,
        )
        .bind(issueId)
        .all<{ erased: number } & Record<string, string>>()
    ).results;
    writes.push({
      sql: `INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN (SELECT count(*) FROM ${table} WHERE issue_id=?)=? THEN 1 ELSE 0 END`,
      params: [issueId, rows.length],
    });
    for (const row of rows) {
      const keys = columns.map((name) => JSON.parse(row[name]) as StoredValue);
      const predicate =
        `issue_id=? AND erased=? AND ` +
        columns
          .map(
            (name) =>
              `${name} IS (SELECT ${restoreValueSql("k.value")} FROM (SELECT ? value) k) AND typeof(${name})=json_extract(?,'$[0]')`,
          )
          .join(" AND ");
      const params = [
        issueId,
        row.erased,
        ...keys.flatMap((value) => [
          JSON.stringify(value),
          JSON.stringify(value),
        ]),
      ];
      writes.push({
        sql: `INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM ${table} WHERE ${predicate}) THEN 1 ELSE 0 END`,
        params,
      });
      if (row.erased === 0) {
        const hashed = await Promise.all(
          keys.slice(1).map(erasedStoredSourceIdentity),
        );
        writes.push({
          sql: `UPDATE ${table} SET ${columns
            .slice(1)
            .map((name) => name + "=?")
            .join(",")},erased=1 WHERE ${predicate}`,
          params: [...hashed, ...params],
        });
      }
    }
  }
  return writes;
}
