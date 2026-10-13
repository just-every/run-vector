# Installation archives

Stop development before moving data. The public commands use Base's complete local D1/R2 portability engine, with Vector's schema and attachment preflight:

```sh
pnpm run export -- --output exports/vector.jsonl
pnpm run import -- --input exports/vector.jsonl --yes
```

Export creates a new owner-only archive; it never overwrites one. Import requires an empty product installation and empty FILES bucket. Use confirmed reset only after preserving an export and backups. Setup after restore must use the archived installation owner's email. Authenticated HTTPS and exact loopback HTTP targets use the same Base transport. Vector admits complete restore only into a pristine bootstrap created after migration 0034, with one ordinary owner session and its exact consumed source link. The coordinator and final transaction preserve custody and retire that authority atomically; sign in freshly as the historical owner afterward. See [Archives](ARCHIVES.md) for admission, uncertain settlement and rollback requirements. Local Worker HTTP proof does not establish hosted HTTPS acceptance.

The archive preserves domain IDs, nonsecret auth identity mappings, timestamps, versions, history, removed-operator records, views/preferences, delivery histories and the full FILES bucket with bytes and metadata. Deleted-file tombstones may refer to already removed objects; live attachments must exist with the recorded size. Unclassified tables or columns and missing live attachments refuse export. The two migration-initialized derived state rows are the documented replaceable bootstrap set. FTS tables/shadows are excluded and rebuilt from stable primary TEXT IDs in the import-completion transaction.

No session, sign-in token, external identity, signing/provider secret, development outbox or transient rate limit is restored. Nonsecret `oa_operators` and Vector's mapping rows preserve history without granting access. An active archived installation owner receives fresh destination access. If that historical owner was removed, trusted destination configuration must name an already-active archived operator; health admits that replacement only while no restore grant exists. Request emails never establish this authority. Other restored operators require explicit approval through authenticated `/api/data/restore/operators/:id` review or a new native invitation. Source cookies and links never work at the destination.

The same import commit creates a destination restore hold and quarantines every historical notification delivery. The operator reviews `/api/data/restore` and reconfigures effects, then explicitly posts `/api/data/restore/review-effects` before resuming new delivery; pending, accepted and uncertain imported records retain their original state and are never automatically resent, even after review. Imported history generates no new activity, audit or notifications. Restore review state and approval records are destination-only bookkeeping and do not affect archive equality.

Archives are private copies. Keep a later erasure journal when restoring older archives after deletion; a previously downloaded file cannot prove later erasure. Preserve additive migrations and matching source for compatible rollback. Recover databases and objects together in isolated resources before switching traffic. Local proof does not establish provider backup, hosted restore or live delivery acceptance.
