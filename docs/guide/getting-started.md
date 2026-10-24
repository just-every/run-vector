# Getting started

Vector runs on your own computer first. Open a terminal (on a Mac, Terminal in Applications → Utilities; on Windows, your WSL2 distribution), copy this line into it and press Enter:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-vector
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-vector` does the same.

The line installs `rer`, the Run Edit Run command, clones Vector into a `run-vector` folder, installs everything, makes you the local owner and starts Vector. It prints a link that starts with `RER_OPEN`: open it in a browser on the same computer and you are signed in as the owner. The link carries a private key for this copy, so never share it. The first time, Vector opens **Finish setting up Vector**. This free copy runs only on your computer: it sends no email, and nobody else can open it.

If the installer prints a line that puts `rer` on your PATH, run that line too. To start Vector again later, run the same line from the same folder, or `cd run-vector && rer dev`. `rer dev --stop` stops it.

Next: [Run it on your computer](install.md) covers choosing your owner and settings, and putting Vector on your own Cloudflare account.
