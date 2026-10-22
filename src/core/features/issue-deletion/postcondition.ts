import type { D1Database } from "../../../../vendor/base/import-kit/src/d1/index";
import { erasedStoredSourceIdentity } from "../integrations/source-identity";
import {
  isStoredNull,
  storedInteger,
  storedNull,
  storedRow,
  storedText,
} from "../../shared/sql/stored-value";
import { projectedPostcondition } from "./postcondition-sql";
import type { ErasureSnapshot } from "./snapshot";
export type ErasureOperation = {
  id: string;
  identifier: string;
  workspace: string;
  actor: string;
  at: string;
  operationId: string;
};

/** Everything is absent unless deliberately retained below. Only immutable,
 * byte-exact preimages feed this expectation; private rows are never persisted. */
export async function erasedSnapshot(
  db: D1Database,
  before: ErasureSnapshot,
  operation: ErasureOperation,
): Promise<ErasureSnapshot> {
  const { at, actor, identifier, workspace, operationId } = operation;
  const after: ErasureSnapshot = Object.fromEntries(
    Object.keys(before).map((name) => [name, []]),
  );
  after.issue_deletions = [
    ...before.issue_deletions,
    storedRow({
      issue_id: operation.id,
      identifier,
      workspace_id: workspace,
      requested_at: at,
    }),
  ];
  after.audit_records = [
    ...before.audit_records,
    storedRow({
      id: operationId,
      actor_operator_id: actor,
      action: "issue.deleted",
      workspace_id: workspace,
      actor_kind: "person",
      actor_reference: `person:${actor}`,
      subject_identifier: identifier,
      subject_id: operation.id,
      created_at: at,
      updated_at: at,
    }),
  ];
  // Keep only durable object custody until cleanup can prove R2 absence.
  after.detached_file_removals = [
    ...before.detached_file_removals,
    ...before.issue_files
      .filter((row) => isStoredNull(row.removal_confirmed_at))
      .map((row) => ({
        id: row.id,
        issue_id: row.issue_id,
        identifier: storedText(identifier),
        actor_operator_id: row.actor_operator_id,
        blob_key: row.blob_key,
        bytes: row.bytes,
        writer_settled: row.writer_settled,
        content_sha256: row.content_sha256,
        removal_requested_at: isStoredNull(row.removal_requested_at)
          ? storedText(at)
          : row.removal_requested_at,
        removal_actor_operator_id: isStoredNull(row.removal_actor_operator_id)
          ? storedText(actor)
          : row.removal_actor_operator_id,
        removal_confirmed_at: storedNull(),
        deleted_at: row.deleted_at,
        cleanup_error: row.cleanup_error,
        updated_at: storedText(at),
      })),
  ];
  const projected = await projectedPostcondition(db, before, operation);
  after.children = projected.children;
  after.child_parent_activity = [
    ...before.child_parent_activity,
    ...projected.child_parent_activity,
  ];
  for (const table of ["vector_source_records", "vector_source_receipts"])
    after[table] = await Promise.all(
      before[table].map(async (row) =>
        row.erased[1] === "1"
          ? row
          : {
              ...row,
              record_id: storedText(
                await erasedStoredSourceIdentity(row.record_id),
              ),
              erased: storedInteger(1),
              ...(table === "vector_source_receipts"
                ? {
                    revision_id: storedText(
                      await erasedStoredSourceIdentity(row.revision_id),
                    ),
                  }
                : {}),
            },
      ),
    );
  // SQLite itself applies JSON redaction to the captured bytes, preserving its
  // exact numeric lexemes and string escaping for unrelated envelope fields.
  after.vector_webhook_events = before.vector_webhook_events.map((row) => ({
    ...row,
    body: storedText("{}"),
  }));
  for (const table of [
    "integration_deliveries",
    "integration_replays",
    "integration_resolutions",
  ])
    after[table] = projected[table];
  // Digest envelopes retain no issue payload and keep their terminal slot fence.
  after.notification_digest_batches = before.notification_digest_batches;
  after.notification_digest_attempts = before.notification_digest_attempts;
  after.notification_digest_windows = before.notification_digest_windows;
  after.integration_attempts = before.integration_attempts;
  after.vector_webhook_restore_holds = before.vector_webhook_restore_holds;
  const ids = new Map(
    [
      ...before.vector_webhook_events,
      ...before.integration_deliveries,
      ...before.integration_replays,
    ].map((row) => [JSON.stringify(row.id), row.id]),
  );
  after.vector_webhook_erasures = [
    ...before.vector_webhook_erasures,
    ...[...ids]
      .filter(
        ([key]) =>
          !before.vector_webhook_erasures.some(
            (row) => JSON.stringify(row.id) === key,
          ),
      )
      .map(([, id]) => ({
        ...storedRow({ namespace: workspace, identifier, erased_at: at }),
        id,
      })),
  ];
  return after;
}
