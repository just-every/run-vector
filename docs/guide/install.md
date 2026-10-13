# Run it on your computer

You need Node 22.20.0 and pnpm 10.12.4. From a copy of the source, install the locked dependencies, prepare your owner account, then start Vector:

```sh
node scripts/rer.mjs install
node scripts/rer.mjs setup --owner-email you@example.com --non-interactive
node scripts/rer.mjs dev
```

Setup builds the app, prepares its local database, creates your owner account and workspace, and stops again. Running it a second time keeps your owner, data and settings. Nothing is sent by email while you run Vector on your computer.

## Open it

`dev` prints a link that starts with `RER_OPEN`. Open it in a browser on the same computer and you are signed in as the owner. The link carries a private key for this copy of Vector, so never share it.

The first time, Vector opens **Finish setting up Vector**. Check the workspace, timezone and first team that setup prepared, then choose **Open my workspace**. You can change all of them later in Settings.

## Stop, start and reset

Stop Vector with Ctrl-C, or with `node scripts/rer.mjs dev --stop`. Start it again with `node scripts/rer.mjs dev`; your data stays where it was.

To start over, stop Vector, keep an export of anything you need (see [Your data](data.md)), then run `node scripts/rer.mjs reset --yes`. Reset lists exactly what it removes before it removes it.

## Choosing your settings

Setup reads its questions from `rer-setup.json`. To choose the workspace name, timezone or first team yourself, put your answers in a private JSON file and pass it with `--answers`. The [command contract](../../SEED-COMMAND-CONTRACT.md) lists every flag and exit code, and the [installer notes](../INSTALLER.md) describe setup in more detail.

When you want Vector running for your whole team, follow the [deployment guide](../../DEPLOY.md).
