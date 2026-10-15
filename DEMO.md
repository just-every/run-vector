# Vector demos

Use Node 22.20.0 and this checkout's pinned `@runeditrun/rer` 0.2.16. Install and set up a local owner, then start a throwaway demo:

```sh
rer install
rer setup --owner-email owner@example.test --owner-name "Demo owner" --non-interactive
rer demo
rer demo --stop
```

Stop an ordinary `rer dev` before starting a demo. Open the private `RER_OPEN` link printed by the command; it signs in the saved owner through Base's dev identity. Do not share the link. The demo completes first-run setup and provides Vector's existing sample: two teams, eight issues, projects, cycles, labels, evidence, dependencies and a saved view. Sample references to Sarah resolve to the signed-in owner; sample session records are never inserted. Conflict-safe inserts preserve demo edits on repeated requests.

Demo data lives under `.rer/demo/<start-time>/`. Vector passes `RER_STATE_DIR` to migrations and Vite, and its installer forwards the demo switches. Stopping removes that directory; the normal `.wrangler/state` is unchanged. The Demo bar lists captured mail and blocked sends. Base's guard wraps the actual Worker entry at `src/core/app/worker.ts`, and Vite installs the socket guard first. Without `RER_DEMO=1`, the wrapper returns the original Worker.

The vendored guard under `vendor/demo/demo` comes from Base `rer-v0.2.12`, commit `c1cd7bfa55388886f9607cfe03e758aba09e98e4`. HTML escaping reuses Vector's auth copy at `479094f0b26a639a1868fa521004581ec8dbcb63`; CSP and loopback helpers are imported from the `@runeditrun/rer` 0.2.16 package pinned by this checkout. This import adaptation does not establish byte identity with the original package. `edition.json` and `sources.lock.json` record the demo comparison origin and import adaptation; `base-copies.json` records its five unchanged files. Vector's authentication implementation remains at its existing single pin.

## Mail and integrations

Assignment and mention mail use the demo outbox, including at an HTTPS demo origin. Hosted demos keep production authentication: HTTPS origin checks, Secure `__Host-` cookies, signed owner claims and replay refusal. The full development outbox remains private; the Demo bar shows recipient and subject.

Hosted sign-in mail is not accepted yet. Base accepts a development receipt only with local authentication, so at an HTTPS demo origin it captures then revokes the link and `/auth/request` returns `503 mail_unavailable`. Initial signed owner-claim entry works. This does not enable local authentication on HTTPS or establish provider acceptance.

Signed outbound webhooks require an enforcing `INTEGRATION_EGRESS` binding. The demo supplies no `INTEGRATION_EGRESS` binding, so events remain queued and no delivery runs. Signed GitHub pull-request events are inbound and persist links without a GitHub API request. Demo mode adds no outbound probe route.

## Hosted demo

`deploy-demo.json` declares `demo.run-vector.com` and the demo settings. The front supplies `OWNER_EMAIL=owner@demo.invalid`; Vector's settings use the matching `FIRST_OWNER_EMAIL`. Demo owner-claim checks use the configured `APP_ORIGIN`; non-demo owner-claim configuration still requires `RER_OWNER_CLAIM_APP_ORIGIN` to match.

`.github/workflows/run-demo.yml` is manual dispatch in the `run-demo` environment and restricted to the RunEditRun account. `test_only=true` targets `demo.test.run-vector.com` with Turnstile test keys; `remove=true` removes only that selection's recorded resources. Production uses its real Turnstile variable and secrets. The workerd container import boundary was fixed in `rer` 0.2.14+; Vector builds with its existing Cloudflare imports and restore coordinator.

The earlier hosted startup acceptance run on `rer` 0.2.15 reached readiness in 7 of 10 attempts, with a 13.747-second median; its last three attempts returned capacity `503`. Isolation passed. The current checkout pins `rer` 0.2.16. Its production deploy succeeded, and a 2026-10-15 start-page GET returned `200` with real non-test Turnstile and no `Set-Cookie`; the readback executed no JavaScript. A public fetch proof remains blocked by the existing dependency-relink step-up requirement (`403 step_up_required`); the successful start-page readback does not establish that acceptance.

```sh
rer deploy --demo --dry-run
# After hosted deployment is separately authorized:
rer deploy --demo --environment production
rer deploy --demo --remove --yes --environment production
```

For manual test-host deployment or removal, set the declaration's domain to `test.run-vector.com` in a disposable checkout and use `--environment demo-test`. The workflow does this automatically. Base removal checks ownership and removes only the selected demo's recorded Custom Domain, Container application and front Worker.
