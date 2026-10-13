# Erasing an imported person (DATA-011, part of BASE-DATA-003)

Vector erases a person that imports carried: someone named in a Linear or
mapped CSV/JSON file, or in a Linear API file, who may never have had an
account. It also finishes the job for a removed operator, whose identity rows
OPS-004 removal has already replaced. It does not erase a current member: remove
them in Settings first (docs/OPERATOR-REMOVAL.md), which transfers their work
and revokes their sessions and tokens.

## Routes

All three need a signed-in operator session and a same-origin request.

| Route | What it does |
| --- | --- |
| `POST /api/data/erasure/preview` | Body `{ "email"?: string, "names"?: string[] }` (an exact email and/or up to five exact display names). Returns counts only (imported comments, reports, report rows, development mail) and the confirmation text. Refuses `409 operator_active` when the email or a name belongs to a current operator or open invitation. |
| `POST /api/data/erasure` | Body `{ "subject": {...}, "confirmation": "erase <email or first name>" }`. Erases in one D1 batch and returns the journal entry (records erased, jobs and streams retired, rows per store) and Vector's counts. A wrong confirmation is `400 confirmation_mismatch`; an import that changed while erasing is `409 erasure_conflict` with nothing written. |
| `GET /api/data/erasure/journal` | The append-only erasure journal: receipt ids, times and counts, never an erased value. |

Matching is exact and case-insensitive: a whole cell or JSON string equal to
the email or a name, never a substring of a longer value. Originals (the
retained file bytes) are withdrawn when their text holds a value anywhere.

## What one erasure changes

All of it commits in one D1 batch, or none of it does.

- **Import custody** (Base import-kit `retireD1ImportCustody`). In every run,
  applied or still pending, each record whose source row or API data holds the
  person becomes a permanent tombstone: it never publishes, replays or comes back
  after undo. Runs whose label equals the email are retired whole. Originals
  that hold the person are withdrawn. The journal row and the restore checkpoint
  are written in the same batch.
- **Issues already written stay.** A record that was already published keeps its
  issue; only its custody copy is erased. A pending run still finishes: the
  erased records are skipped, and a parent or blocker link that pointed at an
  erased record that never published is left out (rollback compares without it
  too).
- **Vector's copies.** Imported comments the person wrote lose their body and
  author name and read as deleted. Reconciliation reports lose every cell that
  held a value and list those rows as erased. Development mail that names them is
  dropped. The search indexes are optimised so no deleted term survives in their
  shadow tables.
- **Archives.** An archive made before the erasure is refused on restore
  (`400 erasure_epoch`) when a later archive's journal is supplied
  (`rer import --journal LATER_ARCHIVE`, or `laterJournal` on HTTP finalize). An
  archive made after it restores and holds nothing of the person.

## Proof

`tests/worker/imported-person-erasure.test.ts` imports two generated Linear
workspaces with API files: one run applied whole, one stopped after its first
batches. It erases a stranger by name, then a removed operator by email and
name. It checks that the pending run finishes, that a scan of every column of
every table (shadow tables included, BLOBs and hex/base64 decoded) and every R2
object finds neither person, that the journal has two entries, and that the
older archive is refused while the newer one restores clean.

## Not covered

- A current member: remove them first.
- Free text other people wrote that mentions the person's name (descriptions,
  native comments). Vector does not rewrite other people's words.
- Native work a removed operator authored stays, attributed to "Removed
  operator" by OPS-004 removal.
- A Settings screen. Erasure is available through the routes above.
- Hosted timing. The proof is local; hosted D1 and R2 behaviour is not
  established.
