import { restoredEffectsHeld } from '../data/restore-authority';
import { IssueAccessError } from "../issues/access";
import { fileSettlementDatabase, isMutationAccessError } from "../auth/mutation-database";
import {
  confirmRemoval,
  markWriterSettled,
  pendingRemovals,
  removalAttempt,
  removalRow,
  requestRemovalIntent,
  type FileRemovalRow,
} from "./repository";

export type FileRemovalEnvironment = { DB: D1Database; FILES: R2Bucket };
export type FileRemovalResult = "removed" | "pending" | "failed";
const retryError = "File cleanup could not complete. Retry removal.";

function matchesReservation(row: FileRemovalRow, object: R2Object) {
  if (object.key !== row.blob_key || object.size !== row.bytes) return false;
  // Historical objects had no checksum metadata. Their unique recorded key and
  // size identify the one original PUT; no retry may write that key again.
  return (
    row.content_sha256 === null ||
    (object.customMetadata?.operationId === row.id &&
      object.customMetadata?.sha256 === row.content_sha256)
  );
}

async function completeRemoval(
  env: FileRemovalEnvironment,
  row: FileRemovalRow,
): Promise<FileRemovalResult> {
  if (row.removal_confirmed_at) return "removed";
  if (!row.removal_requested_at) return "failed";
  try {
    if (row.writer_settled !== 1) {
      const object = await env.FILES.head(row.blob_key);
      if (!object) {
        // Absence/age cannot fence a still-running PUT. Preserve its intent/key.
        await removalAttempt(env.DB, row, null);
        return "pending";
      }
      if (!matchesReservation(row, object)) {
        await removalAttempt(
          env.DB,
          row,
          "Stored upload does not match its reservation. Retry recovery.",
        );
        return "failed";
      }
      await markWriterSettled(env.DB, row);
    }
    await env.FILES.delete(row.blob_key);
    if (await env.FILES.head(row.blob_key)) {
      await removalAttempt(env.DB, row, retryError);
      return "failed";
    }
    const readable = await env.FILES.get(row.blob_key);
    if (readable) {
      await readable.body.cancel();
      await removalAttempt(env.DB, row, retryError);
      return "failed";
    }
    const listed = await env.FILES.list({prefix:row.blob_key,limit:1});
    if (listed.objects.some(object=>object.key===row.blob_key)) {
      await removalAttempt(env.DB, row, retryError);
      return "failed";
    }
    if (await confirmRemoval(env.DB, row)) return "removed";
    const current = await removalRow(env.DB, row.issue_id, row.id);
    return current?.removal_confirmed_at ? "removed" : "pending";
  } catch {
    // Even the error write may fail during a D1 outage. Intent was persisted
    // first, so the same ID remains available for a later sweep/retry.
    try {
      await removalAttempt(env.DB, row, retryError);
    } catch {}
    return "failed";
  }
}

export async function requestFileRemoval(
  env: FileRemovalEnvironment,
  issue: { id: string; identifier: string },
  fileId: string,
  actor: string,
  operatorIssue?: { identifier: string },
): Promise<FileRemovalResult> {
  try {
    // Only the operator route supplies current workspace admission. Existing
    // durable reservations and background cleanup keep their settlement path.
    const row = await requestRemovalIntent(env.DB, issue.id, fileId, actor, operatorIssue);
    return row ? completeRemoval({ ...env, DB: fileSettlementDatabase(env.DB) }, row) : "failed";
  } catch (error) {
    if (isMutationAccessError(error) || error instanceof IssueAccessError) throw error;
    return "failed";
  }
}

/** Called by the real scheduled Worker handler and explicit local verification. */
export async function processFileRemovals(env: FileRemovalEnvironment) {
  const results = { processed: 0, removed: 0, pending: 0, failed: 0 };
  if (await restoredEffectsHeld(env.DB)) return results;
  for (const row of await pendingRemovals(env.DB)) {
    const result = await completeRemoval(env, row);
    results.processed++;
    results[result]++;
  }
  return results;
}

/** Bounded postcommit recovery for just the newly deleted issue. */
export async function processDeletedIssueFiles(env:FileRemovalEnvironment,issueId:string){
 const settlement={...env,DB:fileSettlementDatabase(env.DB)};
 if(await restoredEffectsHeld(settlement.DB))return;
 const rows=(await settlement.DB.prepare('SELECT *,1 detached FROM detached_file_removals WHERE issue_id=? AND removal_confirmed_at IS NULL AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1) ORDER BY updated_at,id LIMIT 50').bind(issueId).all<FileRemovalRow>()).results;
 for(const row of rows)await completeRemoval(settlement,row);
}
