# Native application archives

`rer export --target local --output FILE --non-interactive` and
`rer import --target local --input FILE --yes --non-interactive` use the
actual Base portability engine and Vector's explicit schema and FILES policy.
Import is exact restoration, distinct from mapped issue import. Source archive
and checkpoint files are private. An existing export path refuses replacement. Save archives in the checkout's unserved `exports/` folder (for example `exports/vector.jsonl`) or at an absolute path outside the checkout; any other path in the checkout is refused, because the app could serve it. To restore in a different checkout, copy the private archive into that checkout first.

Archives include safe operator identities and mappings, native records,
relationships, original files and metadata, histories, saved views/preferences,
notifications, failed operations, audit records and import originals/journals.
Every native table and column is classified. Unknown schema refuses export.
Derived FTS indexes are rebuilt from stable TEXT identities. Corrupt parts,
wrong schema/product, unsafe values, missing files, unexpected data or unresolved
references refuse. Restore requires an empty native destination apart from the
documented migration and derived bookkeeping tables.

Older version 2 backups can lack the authenticated trigger, view and index
inventory. Ordinary import refuses these backups. If the original installation
cannot export a current backup, use `rer import --input FILE --yes
--acknowledge-unverified-schema-objects` to accept that specific limitation.
This goes through Base's recovery checks and records its unverified-schema
receipt; it still requires an empty destination and valid migration history.
It does not accept version 1 metadata or bypass native restore authority.

A local export or import first reads the database's migration ledger. A database
Run Edit Run Platform migrated records its migrations in `rer_migrations`, which
Wrangler cannot read, so Platform's runner stays its only migration authority:
the transfer runs no Wrangler migrations there and refuses with
`migration_ledger:unapplied:<file>` until Platform has applied every migration
file (or `migration_ledger:multiple` when a Wrangler ledger sits beside it). Any
other database is migrated by Wrangler before the transfer, as before.

Sessions, sign-in links, mail outboxes, provider/signing secrets, transient rate
limits and destination-only grants/holds are excluded. Safe Base operator
identity is included because native foreign keys depend on it. The configured
historical owner signs in freshly after restore. Other historical operators need
explicit destination approval; uninvited emails gain no access. Imported pending,
accepted and uncertain deliveries retain their historical state and remain held.
Review restores access for future work; it never replays historical sends.

The native `/api/portability` HTTP transport uses current cookie authority,
same-origin writes and per-operator job ownership. The pinned `rer export`
saves only the local copy and refuses a hosted origin, and `wrangler d1 export`
refuses Vector's database because it holds FTS5 search tables. To back up a
hosted installation, run Base's transfer client from the checkout with an
absolute private file holding the owner's one `__Host-operator_session=VALUE`
cookie: `node node_modules/@runeditrun/rer/modules/portability/cli.mjs export
--origin ORIGIN --session-file PRIVATE_FILE --out ABSOLUTE_ARCHIVE`. No provider
credentials are used. The archive restores locally with `rer import`.

**Authenticated HTTP restore:** use a fresh installation bootstrapped after
migration 0034, with empty product data and FILES. Sign in once through an ordinary
owner magic link before completing setup or editing any setting. The destination
must retain only that native session and its consumed, non-invitation source link.
Additional sessions, links, operators, credential dependents, edited bootstrap
settings (including the reminder clock), completed setup or product rows refuse
admission. Existing installations upgraded to 0034 are not retrospectively
classified as pristine. An installation created with `rer deploy` is not
pristine either: rer's owner claim leaves a second session, so admission refuses
with `restore_bootstrap_not_pristine` (a known issue in v0.3.0). Stopped local import remains available into empty resources.

Vector records the pristine graph in its original bootstrap transaction and
reserves the destination atomically. Ordinary product/file mutations are fenced
while an import is pending. A `RESTORE_COORDINATOR` SQLite Durable Object serializes
native import calls and R2 settlement; both production and development Worker
exports and the binding are required. This object holds destination-only transport
custody, excluded from application archives. Native D1 jobs, reservations and
owned-object records govern publication and actual R2 settlement. The unchanged
Base engine's final transaction rechecks native session,
version and pristine state, replaces the bootstrap graph, and removes exactly the
restoring session and consumed source link. It retains permanent destination
claim/bootstrap ledgers. No credential is adopted from the archive. The response
expires the cookie; sign in freshly as the historical installation owner. Fresh
normal authority can read the completion receipt at `/api/data/restore`.

Failed publication rolls back native records and cleans only import-owned files;
clean staged jobs can be aborted by the current same job owner. Concurrent import
operations refuse while one is running. A request cut off before any R2
settlement (a transient D1 or R2 error, or a coordinator reset or deploy) leaves
custody only until D1 shows no apply in progress and no files owned by an
unfinished job; the same job then resumes or aborts, and a create that never
reached a Base job releases its reservation. A create whose job committed but whose
reply was lost (a reset, or a transient error Base reports as `import_running`) is
answered by repeating the same create from the same session: it returns that
staging job's id. Another session, or a different manifest, is still refused. If R2 settlement is uncertain, the
coordinator retains custody across restart and reports `restore_settlement_pending`;
do not treat this as a completed failure or clear the reservation while a writer
may still be active. Do not erase destination state while this custody is active
or uncertain. It requires stopped, inspected recovery. Retain migration
0034, its destination ledgers, guards and coordinator custody on compatible-source
rollback. Never replay historical mail or webhooks after reviewing future effects.

Local Worker HTTP tests exercise real ordinary sign-in, D1, R2 and the coordinator,
including populated export/restore/export content equality, original bytes,
revocation, late rollback, concurrent abort, lost commit acknowledgement,
restart custody and resumption after an interrupted request. This is local HTTP proof, not hosted HTTPS/provider acceptance.

### Closed cycle history

Archives include `cycle_snapshots`, `cycle_membership_events` and `cycle_closure_failures` from additive migration 0031. They retain identifiers, project IDs at close, estimates, progress, capacity, timezone and interval changes; no personal issue titles enter these records. Keep them and their guards on compatible-source rollback. Snapshot retention survives issue edits and deletion. The archive engine suppresses and recreates triggers during atomic restore, so restored membership history is not regenerated. Restored scheduled effects remain held pending review; missed cycles close from the restored facts only after release. Existing history erased before 0031 cannot be reconstructed; the migration backfills surviving recorded commitment activity only.

### Due reminder history

Migration 0032 adds the workspace daily clock, `due_reminders` delivered receipts and `due_reminder_suppressions`. Archives retain global issue/date/kind delivery identities with opaque claim and creation time, and each operator's own suppression history keyed by issue/date/kind/operator. These records store no recipient address or name. Identifier-only `due_reminder.delivered` feature/time records in `audit_records` survive issue deletion and are archived; suppressions do not create a user-reaching audit. Restoring does not reset delivery eligibility. New scheduled reminders remain held until destination effects are reviewed. Keep these records, the expanded mute CHECK and historical preferences on compatible-source rollback.

### Deletion and duplicate state

Archives classify every column of `issue_duplicates` (issue/canonical IDs and creation time), `issue_deletions` (issue ID, identifier, workspace and request time) and `vector_webhook_erasures` (namespace, event ID, identifier and erasure time). These portable domain ledgers contain no deleted title/body. Unresolved `detached_file_removals` retain their exact keys until physical removal is confirmed; restore holds remain authoritative. Base import erasure retains hashed source/target identities and withdraws entire affected original artifacts, including files containing other surviving rows. Unrelated originals remain unchanged. Do not remove tombstones or identifier high-water history on rollback or restore.

Issue deletion also redacts retained `integration_replays` envelope bodies while preserving identity/fingerprint/time; operator-entered `integration_resolutions` evidence codes become a fixed deletion code. Native `integration_attempts` outcomes retain only fixed protocol codes and numeric status/retry metadata, never the provider response body. Additive triggers prevent late replay or reconciliation from restoring private projections.

Source record/receipt `erased` columns are classified portable state and part of their respective uniqueness keys. Migration 0033 uses an explicit populated create/copy/swap to add that key discriminator, preserving all old fields as live rows. A valid raw source ID equal to a deleted ID’s digest has separate custody. Tombstone hashes are domain-separated and independent of signing secrets. Local archive proof restores live and erased overlapping identities exactly, excludes signing credentials, rotates a fresh destination secret through the native operator route, then proves same/new erased revisions return 410, conflicting content 409, and the independent live identity remains replayable. Retain schema and tombstones on compatible rollback; reversing 0033 would merge distinct identity domains.

## Project planning upgrade

Apply forward migration `0062_project_fields.sql` after 0061. Existing projects
keep their target date, acquire no start date or labels and use No priority.
Project start dates, priority, project-label membership and the label’s project
flag are classified in the native archive and restore with project activity.
Keep the additive columns, tables and validation guards on a compatible-source
rollback; never reverse an applied migration. `tests/worker/data-http.test.ts`
restores populated planning fields through the authenticated HTTP archive door;
`tests/worker/project-fields-upgrade.test.ts` covers populated upgrades.
