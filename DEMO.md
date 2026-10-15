# Vector demos

Use Node 22.20.0 and this checkout's pinned `@runeditrun/rer` 0.2.20:

```sh
rer install
rer setup --owner-email owner@example.test --non-interactive
rer demo
rer demo --stop
```

Open the private `RER_OPEN` link to enter as the saved owner. Vector supplies two teams, eight issues, projects, cycles, labels, evidence, dependencies and a saved view. Sample references to Sarah resolve to that owner; sample sessions are never inserted. The nav and title read **Vector Demo**, or **Vector Dev** under `rer dev`. There is no demo bar or captured-mail viewer.

Demo data lives under `.rer/demo/<start-time>/` and disappears on stop. `RER_STATE_DIR` isolates it from `.wrangler/state`. The verbatim `vendor/base/demo` module comes from Base `rer-v0.2.20` (`38aa7efdb3cceec585d2344ed54dd559295b9059`), beside its operator-auth dependencies. `withDemo` is the Worker's first import; `demoSockets()` is Vite's first plugin. `base-copies.json`, `edition.json` and the source lock record the selection. The sample-data hook is unchanged.

Public internet reads and checks run for real. External HTTP writes return provider success without contacting their destination. A POST-based public check uses `fetchDemoRead`; Vector currently has no such probe. Mail returns accepted without retaining a message. Signed outbound webhooks use `demoEffect` around the RPC binding and receive a 204 success, so demo deliveries complete without a production egress binding. These behaviors apply only with `RER_DEMO=1`; ordinary installations retain real sends and enforcing egress requirements. Production build/deploy refuses demo configuration.

Hosted demos keep HTTPS authentication, Secure cookies, signed owner claims, Turnstile, per-IP admission limits and isolated throwaway containers. `deploy-demo.json` keeps its existing instance type (Base's default `basic`). The front supplies `OWNER_EMAIL=owner@demo.invalid`, matching Vector's `FIRST_OWNER_EMAIL` setting.

The manual **Run demo** workflow uses the `run-demo` environment on the RunEditRun account. `test_only=true` selects `demo.test.run-vector.com` with Turnstile test keys; `remove=true` removes only that selection's recorded resources. Production uses the real Turnstile widget.

```sh
rer deploy --demo --dry-run
rer deploy --demo --environment production
```

For removal, use the workflow's `remove` input and select the same test/production host. Base verifies ownership and reads back removal of the selected Custom Domain, Container application and front Worker. Startup timings and hosted acceptance belong to the current external task evidence.
