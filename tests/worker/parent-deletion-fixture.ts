import { env } from "cloudflare:workers";
import { create, ids } from "./bulk-parent-fixture";
import { updateIssueParent } from "../../src/core/features/parents/repository";
import {
  addComment,
  addFile,
  finalizeFile,
} from "../../src/core/features/discussion/repository";
import { createUlid } from "../../src/core/shared/ids";
export async function fixture(parentFields:Record<string,unknown>={}) {
  const parent = await create(parentFields),
    child = await create(),
    grandchild = await create();
  await updateIssueParent(env.DB, child.identifier, ids.sarah, {
    expectedVersion: child.version,
    parentIdentifier: parent.identifier,
  });
  await updateIssueParent(env.DB, grandchild.identifier, ids.sarah, {
    expectedVersion: grandchild.version,
    parentIdentifier: child.identifier,
  });
  const comment = await addComment(
    env.DB,
    parent.id,
    ids.sarah,
    "Commented parent evidence",
  );
  await env.DB.prepare(
    "INSERT INTO issue_links(id,issue_id,comment_id,actor_operator_id,name,url,created_at,updated_at) VALUES(?,?,?,?,?,'https://example.com','now','now')",
  )
    .bind(
      createUlid(new Date()),
      parent.id,
      comment,
      ids.sarah,
      "Parent comment link",
    )
    .run();
  const files = [];
  for (const state of ["ready", "deleted", "pending"]) {
    const id = createUlid(new Date()),
      key = `deletion/${id}`;
    await addFile(env.DB, parent, ids.sarah, {
      id,
      key,
      name: "Evidence",
      contentType: "text/plain",
      bytes: 4,
      sha256: "checksum",
    });
    if (state !== "pending") {
      await env.FILES.put(key, "data", {
        customMetadata: { operationId: id, sha256: "checksum" },
      });
      await finalizeFile(env.DB, parent.id, id, ids.sarah);
    }
    if (state === "deleted")
      await env.DB.prepare(
        "UPDATE issue_files SET deleted_at='earlier',removal_requested_at='earlier' WHERE id=?",
      )
        .bind(id)
        .run();
    files.push({ id, key, state });
  }
  return { parent, child, grandchild, files };
}
export async function receipt() {
  const tables = [
    "issues",
    "issue_comments",
    "issue_links",
    "issue_files",
    "detached_file_removals",
    "issue_parents",
    "issue_activity",
    "search_issues",
    "audit_records",
    "issue_list_revision",
    "issue_deletions",
    "ik_d1_erased_targets",
    "vector_webhook_events",
    "vector_webhook_erasures",
  ];
  return Object.fromEntries(
    await Promise.all(
      tables.map(async (t) => [
        t,
        (await env.DB.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all())
          .results,
      ]),
    ),
  );
}
