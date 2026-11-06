import {
  canonicalJson,
  type D1TargetAdapter,
} from "../../../../vendor/base/import-kit/src/d1/index";
import { nativeTargets } from "../data/import/native-targets";
import {
  snapshotExpression,
  expectedExpression,
  snapshotContext,
  snapshotParts,
  type ErasureSnapshot,
} from "./snapshot";
import { erasedSnapshot, type ErasureOperation } from "./postcondition";

/** Per-request erasure adapter. Base fences this complete native preimage and
 * the explicit absent/anonymized postcondition in its real custody transaction. */
export function deletionTargets(operation: ErasureOperation): D1TargetAdapter {
  let before: ErasureSnapshot | undefined, after: ErasureSnapshot | undefined;
  const context = (captured: ErasureSnapshot | undefined) => [
    operation.id,
    operation.identifier,
    operation.workspace,
    canonicalJson(captured ?? {}),
  ];
  const identity = (destination: string, kind: string, id: string) => {
    if (
      kind !== "issue" ||
      id !== operation.id ||
      destination !== operation.workspace
    )
      throw Error("unsupported_deletion_target");
  };
  return {
    ...nativeTargets,
    async read(db, destination, kind, id) {
      identity(destination, kind, id);
      // Read every full relation in one SQLite transaction, using the same
      // bounded parts as the commit guard. The growing activity and audit
      // inventories must not exceed D1's per-statement SQL byte limit.
      const results = await db.batch(snapshotParts.map(part => db.prepare(
        `${part.context} SELECT ${part.current} value FROM c,b WHERE EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=c.id AND t.workspace_id=c.workspace)`,
      ).bind(...context(undefined)))) as {results:{value:string}[]}[];
      if (!results[0].results[0]) return undefined;
      before = Object.fromEntries(snapshotParts.map((part,index) => [part.name,JSON.parse(results[index].results[0].value)])) as ErasureSnapshot;
      after = await erasedSnapshot(db, before, operation);
      return {
        destination,
        targetKind: kind,
        targetId: id,
        value: before,
        revision: before.issues[0].version[1],
      };
    },
    matches(row, destination, kind, id) {
      identity(destination, kind, id);
      if (!before || !after) throw Error("IMPORT_ERASURE_NATIVE_MISSING");
      return {
        sql: `(${snapshotContext}, e AS (SELECT ? value) SELECT ${snapshotExpression}=${expectedExpression} FROM c,b,e)`,
        params: [...context(before), canonicalJson(row ? row.value : after)],
      };
    },
    matchesParts(row, destination, kind, id) {
      identity(destination, kind, id);
      if (!before || !after) throw Error("IMPORT_ERASURE_NATIVE_MISSING");
      const expected = (row ? row.value : after) as ErasureSnapshot;
      // Visibility CTEs and the kit's custody guards share this SQL statement.
      // Compare each complete relation separately to bound expression depth;
      // Base requires every part in the same atomic erasure transaction.
      return snapshotParts.map(({ name, current, expected: expression, context:partContext }) => ({
        sql: `(${partContext}, e AS (SELECT ? value) SELECT ${current}=${expression} FROM c,b,e)`,
        params: [...context(before), canonicalJson({ [name]: expected[name] })],
      }));
    },
  };
}
