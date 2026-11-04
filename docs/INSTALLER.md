# Install Vector

You need Git. One line installs the global `rer` launcher, clones Vector and starts it; the installer brings Node and pnpm:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-vector
```

Have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-vector` is an alternative. The installer links `rer` at `$HOME/.local/bin/rer`. In a new terminal, run `export PATH="$HOME/.local/bin:$PATH"` before the `rer` commands below, or use `"$HOME/.local/bin/rer"` directly. See [the README](../README.md#run-it-on-your-computer) to keep that PATH setting.

Inside this checkout, rer selects the version pinned in `package.json`, independently of the global launcher’s version. Vector release numbers are separate: [tagged releases](https://github.com/just-every/run-vector/tags) use their own recorded CLI pin, while the install line follows `main`. See [the public install guide](guide/install.md) for default-branch and tagged-release choices. Run `rer dev` to try Vector with no setup command or provider account. A fresh checkout initializes the local placeholder owner `owner@run-vector.test`.

To choose your own local owner, optionally run `rer setup --owner-email EMAIL --non-interactive` before the first development run. Setup reads rer-setup.json, creates private .dev.vars, builds without settings, applies forward migrations and prepares one owner/workspace. Supply a private `--answers` JSON file for declared workspace, timezone and team choices. Repeating setup preserves existing settings, owner and data. Setup stops its temporary Worker before returning.

An initialized placeholder owner cannot be silently replaced by setup. Keep the existing owner and data, or, only for a disposable local installation, stop development, retain any needed export, explicitly run `rer reset --yes`, then setup with the chosen mailbox. Reset deletes local owner, sessions and data.

Run `rer dev` and open the `RER_OPEN` link it prints to enter as the owner. `--as teammate` selects the second dev operator; legacy `--login` uses the same automatic owner entry. Development has no badge, toolbar or captured-mail UI. Keep `RER_OPEN` private: its fragment carries this checkout's dev key. Your first entry returns to `/setup`: review the prepared workspace and choose Open my workspace. Later `/setup` visits enter the app. Local setup needs no provider credential and sends no email. Preview serves production output and prints its ready address without captured-mail sign-in. Stop the background development server with `rer dev --stop`.

The browser installer offers local installation only and rejects hosted-target answers. Deploy separately with `FIRST_OWNER_EMAIL="$OWNER_EMAIL" rer deploy --environment production`, using the owner-account inputs in DEPLOY.md. `OWNER_EMAIL` selects the hosted owner at deployment; the assignment maps it to the current adapter’s internal `FIRST_OWNER_EMAIL` binding. Local setup does not select the hosted owner. Production requires configured outbound email or an Auth SSO setup dependency with approval/linking complete; Vector’s documented deployment path uses SendGrid. `rer signin` remains hosted owner recovery with the deploying checkout’s Cloudflare credentials.

README.md gives the fresh-clone steps. SEED-COMMAND-CONTRACT.md lists flags, exits, reset inventory and state custody. DEPLOY.md describes owner-account deployment and its separate credential boundary. Local setup is not hosted deployment or mailbox delivery evidence.
