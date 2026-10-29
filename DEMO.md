# Vector demos

Use Node 22.20.0 and this checkout's pinned `@runeditrun/rer` 0.2.40:

```sh
rer install
rer setup --owner-email owner@example.test --non-interactive
rer demo
rer demo --stop
```

Open the private `RER_OPEN` link to enter as the saved owner. Vector supplies two teams, eight issues, projects, cycles, labels, evidence, dependencies and a saved view, plus a sample initiative over the demo projects, a release with scope, a team document and an Insights dashboard. Sample references to Sarah resolve to that owner, and the sample teammates take the owner's email domain; sample sessions are never inserted. The nav and title read **Vector Demo**, or **Vector Dev** under `rer dev`. There is no demo bar or captured-mail viewer.

Demo data lives under `.rer/demo/<start-time>/` and disappears on stop. `RER_STATE_DIR` isolates it from `.wrangler/state`. The verbatim `vendor/base/demo` module comes from Base `rer-v0.2.40` (`9eb83c85a9088c16ffe94a3af43e8a2e95acc377`), refreshed together with every other recorded Base copy. `withDemo` is the Worker's first import; `demoSockets()` is Vite's first plugin. `base-copies.json`, `edition.json` and the source lock record the selection. The sample-data hook is unchanged.

Public internet reads and checks run for real. External HTTP writes return provider success without contacting their destination. A POST-based public check uses `fetchDemoRead`; Vector currently has no such probe. Base's development mail validates and silently suppresses demo mail, so invitations and sign-in links complete without sending or retaining a message; the demo owner confirms owner actions without an email step. Signed outbound webhooks use `demoEffect` around the RPC binding and receive a 204 success, so demo deliveries complete without a production egress binding. These behaviors apply only with `RER_DEMO=1`; ordinary installations retain real sends and enforcing egress requirements. Production build/deploy refuses demo configuration.

Hosted demos keep HTTPS authentication, Secure cookies, signed owner claims, Turnstile and per-IP admission limits. Each admitted visitor gets their own native Worker Loader isolate: `DB` and the `VectorRestoreCoordinator` Durable Object become SQLite facets of that visitor's storage, `FILES` (R2) objects live in the same visitor storage, and the every-minute cron runs by alarm. Static files are served at the edge. A copy ends after 60 minutes, 15 idle minutes or sign-out, and its storage is erased. The demo owner is Sarah Chen of the fictional Lumen Freight: the front supplies `OWNER_EMAIL=sarah@lumenfreight.example` (a reserved `.example` domain), matching Vector's `FIRST_OWNER_EMAIL` setting; keep the two equal.

The **Run demo** workflow (`.github/workflows/run-demo.yml`, Base's `export/run-demo.yml`, recorded in `base-copies.json`) uses the `run-demo` environment on the RunEditRun account. `test_only=true` selects `demo.test.run-vector.com` with Turnstile test keys; `remove=true` removes only that selection's recorded resources. Production uses the real Turnstile widget.

```sh
rer deploy --demo --dry-run
rer deploy --demo --environment production
```

For removal, use the workflow's `remove` input and select the same test/production host. Base verifies ownership and reads back removal of the selected Custom Domain and Worker. Startup timings and hosted acceptance belong to the current external task evidence.
