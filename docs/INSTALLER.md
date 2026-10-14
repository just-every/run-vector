# Install Vector

Use Node 22.20.0 and the published `rer` command. `rer install` provisions the pinned pnpm automatically. Run `rer install`, then `rer setup --owner-email EMAIL --non-interactive`. Setup reads rer-setup.json, creates private .dev.vars, builds without settings, applies forward migrations and prepares one owner/workspace. Supply a private `--answers` JSON file for declared workspace, timezone and team choices. Repeating setup preserves existing settings, owner and data. Setup stops its temporary Worker before returning.

Run `rer dev` and open the `RER_OPEN` link it prints: you land signed in as the owner (`--as teammate` starts as the second dev operator; `--login` turns dev identity off and prints the key-gated development outbox, where you follow the newest sign-in message and press Confirm; opening that link alone is inert). Your first sign-in returns to /setup: review the prepared workspace and choose Open my workspace. Later /setup visits enter the app. Local setup needs no provider credential and sends no email. Stop the app with Ctrl-C or `rer dev --stop`.

The browser installer offers local installation only and rejects hosted-target answers. Deploy separately with `rer deploy --environment production` (or `rer deploy --environment production`), using the owner-account inputs in DEPLOY.md.

README.md gives the fresh-clone steps. SEED-COMMAND-CONTRACT.md lists flags, exits, reset inventory and state custody. DEPLOY.md describes owner-account deployment and its separate credential boundary. Local setup is not hosted deployment or mailbox delivery evidence.
