# Install Vector

You need Git and the published `rer` command; it provides the exact Node and pnpm this source pins. Run `rer install`, then `rer dev` to try Vector with no setup command or provider account. A fresh checkout initializes the local placeholder owner `owner@vector.test`.

To choose your own local owner, optionally run `rer setup --owner-email EMAIL --non-interactive` before the first development run. Setup reads rer-setup.json, creates private .dev.vars, builds without settings, applies forward migrations and prepares one owner/workspace. Supply a private `--answers` JSON file for declared workspace, timezone and team choices. Repeating setup preserves existing settings, owner and data. Setup stops its temporary Worker before returning.

An initialized placeholder owner cannot be silently replaced by setup. Keep the existing owner and data, or, only for a disposable local installation, stop development, retain any needed export, explicitly run `rer reset --yes`, then setup with the chosen mailbox. Reset deletes local owner, sessions and data.

Run `rer dev` and open the `RER_OPEN` link it prints: you land signed in as the owner (`--as teammate` starts as the second dev operator; `--login` turns dev identity off and prints the key-gated development outbox, where you follow the newest sign-in message and press Confirm; opening that link alone is inert). Your first sign-in returns to /setup: review the prepared workspace and choose Open my workspace. Later /setup visits enter the app. Local setup needs no provider credential and sends no email. Stop the app with Ctrl-C or `rer dev --stop`.

The browser installer offers local installation only and rejects hosted-target answers. Deploy separately with `FIRST_OWNER_EMAIL="$OWNER_EMAIL" rer deploy --environment production`, using the owner-account inputs in DEPLOY.md. `OWNER_EMAIL` selects the hosted owner at deployment; the assignment maps it to the current adapter’s internal `FIRST_OWNER_EMAIL` binding. Local setup does not select the hosted owner.

README.md gives the fresh-clone steps. SEED-COMMAND-CONTRACT.md lists flags, exits, reset inventory and state custody. DEPLOY.md describes owner-account deployment and its separate credential boundary. Local setup is not hosted deployment or mailbox delivery evidence.
