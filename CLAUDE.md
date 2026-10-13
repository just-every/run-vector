# Working on Vector

## Run it locally

Use Node 22.20.0 and pnpm 10.12.4. From this checkout:

```sh
pnpm exec rer install
pnpm exec rer setup --owner-email owner@example.test --non-interactive
pnpm exec rer dev
```

Dev prints its health-ready URL. `rer dev` opens signed in: it prints `RER_SIGNED_IN` (the owner) and `RER_OPEN`, a link that carries this checkout's private dev key in its fragment. Open `RER_OPEN` in a browser on this computer and you land signed in as the owner; a small dev badge switches to the `teammate` persona (a second operator in the same workspace; Vector has no product roles) or signs out. The first switch in a fresh checkout answers `step_up_required`: Base creates an owner-role persona only after the owner's fresh sign-in, so sign out from the badge, sign in at `/signin` as the owner and follow the newest outbox link once; later switches need nothing. Never share the link: the key is what keeps the outbox and dev sign-in closed to anything that reaches this port through a proxy or tunnel, and `reset` removes the key so every earlier browser session stops working. `--as teammate` (or `--as signed-out`) starts as another persona, and `--login` turns dev identity off so dev prints `RER_SIGN_IN` and a key-carrying `RER_OPEN` for the outbox instead: choose the newest message and follow its one-use link (no email is sent). Previews open the outbox the same way. `RER_OPEN` is for people at this terminal; scripts use `rer dev --json` or the key header. API tokens minted in a dev session are recorded as dev-minted and work only on a request that holds the key; mint them with `dev --login` for a client outside this checkout. Finish your first workspace review at `/setup` before entering the app. Stop development before resetting or restoring. Use `pnpm exec rer verify` for full verification, `pnpm exec rer reset --yes` for a confirmed local reset, and `pnpm exec rer export --output exports/vector.jsonl` / `pnpm exec rer import --input exports/vector.jsonl --yes` for local archives. Deploy only when requested with `pnpm exec rer deploy --environment production`. `pnpm exec rer describe` lists the remaining commands.

@AGENTS.md
