# Run it on your computer

You need Git and Node 22 or later, on macOS, Linux or Windows with WSL2. Install the Run Edit Run command once per computer:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
```

(or `npm install --global @runeditrun/rer@0.2.20`). Then get Vector and start it:

```sh
git clone https://github.com/just-every/run-vector.git vector
cd vector && rer dev
```

The first `rer dev` installs the Node, pnpm and dependencies Vector pins, makes you the local owner and prints a link that opens Vector signed in. Nothing is sent by email while you run Vector on your computer.

To choose your own owner email instead of the placeholder, run `rer setup --owner-email EMAIL --non-interactive` in the `vector` folder before the first `rer dev`. Running setup again keeps your owner, data and settings.

## Open it

`dev` prints a link that starts with `RER_OPEN`. Open it in a browser on the same computer and you are signed in as the owner. The link carries a private key for this copy of Vector, so never share it. Development has no badge, toolbar or captured-mail UI. Legacy `rer dev --login` uses the same automatic entry. `rer preview` serves production output and prints its ready address without a captured-mail sign-in flow.

The first time, Vector opens **Finish setting up Vector**. Check the workspace, timezone and first team that setup prepared, then choose **Open my workspace**. You can change all of them later in Settings.

## Stop, start and reset

Stop Vector with Ctrl-C, or with `rer dev --stop`. Start it again with `rer dev`; your data stays where it was.

To start over, stop Vector, keep an export of anything you need (see [Your data](data.md)), then run `rer reset --yes`. Reset lists exactly what it removes before it removes it.

## Choosing your settings

Setup reads its questions from `rer-setup.json`. To choose the workspace name, timezone or first team yourself, put your answers in a private JSON file and pass it with `--answers`. The [command contract](../../SEED-COMMAND-CONTRACT.md) lists every flag and exit code, and the [installer notes](../INSTALLER.md) describe setup in more detail.

## Put it on your own Cloudflare account

When you want Vector running for your whole team, follow the [deployment guide](../../DEPLOY.md) to supply your Cloudflare account, mail sender and owner details, then run:

```sh
FIRST_OWNER_EMAIL="$OWNER_EMAIL" rer deploy
```

`rer deploy` builds Vector, creates its Worker, database and file bucket, and prints the address of your installation. Open it and sign in by email as your owner email: that first sign-in makes you the owner automatically. There is no setup token to enter.

Production requires configured outbound email or an approved Auth SSO setup dependency; the deployment guide uses SendGrid. If the sign-in email does not reach you, run `rer signin` from the same checkout with the same Cloudflare credentials. It prints a one-time link that signs in the owner: it works once, only for the owner, and expires in 15 minutes.

Without `--environment NAME`, `rer deploy`, `rer signin` and `rer deploy --remove --yes` all act on the `production` environment. If you deployed a named environment, pass the same `--environment NAME` to each.

## Update and remove

To update, run these from the checkout that deployed Vector:

```sh
git pull --ff-only
rer deploy
```

Your data and secrets stay as they were. To take the installation down, run this from the same checkout:

```sh
rer deploy --remove --yes
```

It deletes the Worker, database and file bucket that `rer` created, with their data, so export anything you need first. The same command empties the owned file bucket, including attachments, before deleting it; no separate dashboard or Wrangler cleanup is needed. Uncertain ownership or incomplete pagination proof still stops removal.
