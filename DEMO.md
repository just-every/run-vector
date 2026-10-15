# Vector demos

Use Node 22.20.0 and the pinned `@runeditrun/rer` 0.2.12. Install and set up this checkout once, then start a throwaway demo:

```sh
rer install
rer setup --owner-email you@example.com --non-interactive
rer demo
rer demo --stop
```

Stop an ordinary `rer dev` before starting a demo. Open the private `RER_OPEN` link printed by the command. It signs in the saved owner through Base's dev identity; do not share the link. The demo finishes first-run setup and supplies the existing Vector sample: two teams, eight issues, projects, cycles, labels, evidence, dependencies and a saved view. The sample's Sarah references become the real signed-in owner. Sample session records are never inserted. Fixed IDs and conflict-safe inserts preserve demo edits on repeated requests.

Demo data lives under `.rer/demo/<start-time>/`. Vector passes `RER_STATE_DIR` to both migrations and Vite, and its installer environment filter passes the demo switches. Stopping deletes that folder; a later demo starts fresh. Normal `.wrangler/state` is unchanged by the adopted demo path. The Demo bar lists captured mail and blocked sends. Base's guard is the first import of the actual Worker entry, `src/core/app/worker.ts`; Vite installs the socket guard first. Without `RER_DEMO=1`, the wrapper returns the original Worker.

The guard under `vendor/demo/demo` comes from Base `rer-v0.2.12`, commit `c1cd7bfa55388886f9607cfe03e758aba09e98e4`. Its only adaptation is its helper imports: HTML escaping reuses Vector's unchanged auth copy at `479094f0b26a639a1868fa521004581ec8dbcb63`; CSP and loopback utilities are imported in place from the exact `@runeditrun/rer` 0.2.12 package. The latter utilities do not exist at the auth pin, whose older loopback predicate also lacks `*.localhost`. Their package bytes match the demo source commit, preserving the guard's behavior without a second native auth copy. These internal package paths are bound to that exact version. `edition.json` and `sources.lock.json` retain the demo comparison origin and import adaptation; `base-copies.json` records its five unchanged files. Vector's authentication implementation remains at its existing single pin.

## Mail and integrations

Assignment and mention mail use the development outbox in demo mode, including an HTTPS demo origin. Local sign-in mail also uses the outbox. Hosted demos retain production authentication: HTTPS origin checks, Secure `__Host-` cookies, signed owner claims and replay refusal. Their full development outbox stays private; the Demo bar shows recipient and subject.

**Hosted sign-in mail limitation:** the existing Base email-link lifecycle accepts a development receipt only with local authentication. At an HTTPS demo origin, it captures then revokes the link and removes that message through Vector's custody trigger; `/auth/request` answers `503 mail_unavailable`. Initial signed owner-claim entry works. Resolving this requires Base to admit captured demo receipts independently of local authentication. Vector does not report capture as provider acceptance or enable local auth on HTTPS.

Signed outbound webhooks still require `INTEGRATION_EGRESS` and its enforcing policy. The demo supplies neither: events remain queued and no delivery runs. Signed GitHub pull-request events are inbound and persist links without a GitHub API request. Demo mode does not add an outbound probe route.

## Hosted declaration and workflow

`deploy-demo.json` declares `demo.run-vector.com`, with plain demo settings. The front supplies `OWNER_EMAIL=owner@demo.invalid`; Vector's settings provide the matching `FIRST_OWNER_EMAIL`. In demo mode, the existing owner-claim verifier uses the configured `APP_ORIGIN` for its exact audience/origin check. Non-demo owner-claim configuration still requires `RER_OWNER_CLAIM_APP_ORIGIN` to match.

`.github/workflows/run-demo.yml` is manual dispatch, uses the `run-demo` environment, and is restricted to RunEditRun account `b20c0ca9cab0c2b70e13d7cf724b89bd`. `test_only=true` selects environment `demo-test` and hostname `demo.test.run-vector.com`, with Turnstile test keys. `remove=true` runs Base's recorded-resource removal for that same selection. Production uses the environment's Turnstile variable and secrets. No workflow runs on push and no hostname is claimed live by this adoption.

```sh
rer deploy --demo --dry-run
# After hosted deployment is separately authorized:
rer deploy --demo --environment production
rer deploy --demo --remove --yes --environment production
```

For manual test-host deploy/removal, set the declaration's domain to `test.run-vector.com` in a disposable checkout and use `--environment demo-test`. The workflow does this automatically. Base removal checks ownership and removes only the selected demo's recorded Custom Domain, Container application and front Worker.

**Hosted build blocker at 0.2.12:** `rer deploy --demo --dry-run` fails with `Container import boundary failed`. Base applies its Node import restrictions even to the selected workerd engine, refusing Vector's existing Cloudflare env imports and `VectorRestoreCoordinator`. No hosted demo image or live host is proven. Do not bypass the checker or remove the restore coordinator. The Base fix and hosted deployment/readback are required before adding a homepage demo link.

Local proof covers signed-in data and bar at 1440/390, issue creation, stop cleanup, a second fresh instance, and exact normal-state hashes. A built-Worker Miniflare probe separately covers HTTPS signed claims, replay, secure cookies, assignment/mention capture, outbound webhook refusal and inbound PR links; it is not a hosted container proof. The first pre-fix launch exposed the installer's hardcoded migration path and dropped demo environment, and did touch normal state before failing closed. Those adapters were corrected; both subsequent demo starts left the stable stopped normal-state baseline byte-for-byte unchanged. No normal state was reset or restored to obtain that result.
