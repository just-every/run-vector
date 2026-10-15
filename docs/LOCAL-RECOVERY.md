# Recovering a local v0.1.0 installation

Stop the old `pnpm dev` process with Ctrl-C before updating. Stop a newer runtime with `rer dev --stop`. The upgrade refuses `.wrangler/vector-dev` and prints this guide's path; it never moves or deletes that data automatically. Do not use `rer reset` to recover retained data.

v0.1.0 local checkouts initialized sample data, whose owner is `sarah@vector.test`. Its local `/signin` page could fail to load a dynamic module; upgrading preserves those records without relying on that page. A customized installation must retain its actual existing owner instead.

From the checkout, make an owner-only backup outside it. Pick a new backup directory; the commands refuse an existing one:

```sh
VECTOR_BACKUP="../vector-local-backup-$(date +%Y%m%d-%H%M%S)"
(umask 077 && mkdir "$VECTOR_BACKUP")
cp -Rp .wrangler/vector-dev "$VECTOR_BACKUP/vector-dev"
if test -f .dev.vars; then cp -p .dev.vars "$VECTOR_BACKUP/dev.vars"; fi
git rev-parse HEAD > "$VECTOR_BACKUP/source-sha.txt"
```

Retain the matching source revision and any source customizations with that backup. If both state locations exist, preserve both and reconcile in an isolated checkout; never merge SQLite or R2 directories blindly. For an unambiguous installation with no `.wrangler/state`:

```sh
test ! -e .wrangler/state && mv .wrangler/vector-dev .wrangler/state
rer setup --owner-email sarah@vector.test --port 8787 --non-interactive
rer dev
```

Choose a free explicit port and, for customized data, substitute the retained owner's email. Setup applies the forward migrations and creates `.dev.vars` if absent. Open the private `RER_OPEN` entry and finish the one-time workspace review. Check existing issues, comments, due dates and original attachment bytes before discarding any backup. Migration 0046 deletes pending identity-dependency approvals; renew them. Keep all other applied schema and permanent histories on compatible-source rollback.

## If an earlier failed upgrade already wrote .dev.vars

v0.1.0 itself did not need this file. Earlier versions of the new setup could save a guessed `FIRST_OWNER_EMAIL` before refusing legacy state. The current guard runs before Vector prepares settings, but a file from that earlier attempt remains private installation state.

After stopping the runtime and backing up the file, open `.dev.vars` in a local text editor. Change only `FIRST_OWNER_EMAIL` to the retained owner (`sarah@vector.test` for unchanged v0.1.0 sample data); keep `SESSION_SECRET` and every other value unchanged. Do not paste or print the file into a terminal, chat or evidence. Keep its owner-only permissions (`chmod 600 .dev.vars`). Then run the setup command above with that same email. An explicit `--owner-email` does not silently overwrite saved settings or transfer a workspace to another owner.

If owner configuration still refuses, preserve both the settings and state and inspect the retained installation in an isolated checkout. Never delete records or reset the installation to bypass an owner conflict.
