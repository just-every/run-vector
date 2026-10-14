# Run it on your computer

You need Git and the published `rer` command (Node 22 or later is only needed to install it); `rer` provides the exact Node and pnpm Vector pins. From a copy of the source, install the locked dependencies, prepare your owner account, then start Vector:

```sh
rer install
rer setup --owner-email EMAIL --non-interactive
rer dev
```

Setup builds the app, prepares its local database, creates your owner account and workspace, and stops again. Running it a second time keeps your owner, data and settings. Nothing is sent by email while you run Vector on your computer.

## Open it

`dev` prints a link that starts with `RER_OPEN`. Open it in a browser on the same computer and you are signed in as the owner. The link carries a private key for this copy of Vector, so never share it.

The first time, Vector opens **Finish setting up Vector**. Check the workspace, timezone and first team that setup prepared, then choose **Open my workspace**. You can change all of them later in Settings.

## Stop, start and reset

Stop Vector with Ctrl-C, or with `rer dev --stop`. Start it again with `rer dev`; your data stays where it was.

To start over, stop Vector, keep an export of anything you need (see [Your data](data.md)), then run `rer reset --yes`. Reset lists exactly what it removes before it removes it.

## Choosing your settings

Setup reads its questions from `rer-setup.json`. To choose the workspace name, timezone or first team yourself, put your answers in a private JSON file and pass it with `--answers`. The [command contract](../../SEED-COMMAND-CONTRACT.md) lists every flag and exit code, and the [installer notes](../INSTALLER.md) describe setup in more detail.

## Put it on your own Cloudflare account

When you want Vector running for your whole team, follow the [deployment guide](../../DEPLOY.md) to supply your Cloudflare account, mail sender and owner details, then run:

```sh
rer deploy
```

`rer deploy` builds Vector, creates its Worker, database and file bucket, and prints the address of your installation. Open it and sign in by email as your owner email: that first sign-in makes you the owner automatically. There is no setup token to enter.

## Update and remove

To update, run these from the checkout that deployed Vector:

```sh
git pull --ff-only
rer deploy
```

Your data and secrets stay as they were. To take the installation down, run `rer deploy --remove --yes`: it deletes the Worker, database and file bucket that `rer` created, with their data, so export anything you need first.
