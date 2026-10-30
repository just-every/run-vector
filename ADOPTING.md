# Installation-key adoption

Apply `0117_dependency_key_sealing.sql` after the unchanged 0001–0116 migration
sequence, including on populated installations. The additive columns retain the
installation sector and existing dependency rows. Base upgrades legacy signing
keys to authenticated envelopes when read; full rekey seals all interfaces.
Keep the nonsecret sealing marker and key-ID history in archives. Dependency
private keys remain excluded by Vector's archive policy.

`INSTALLATION_KEY` is a required managed secret, generated as 32 random bytes
encoded as lowercase hex by `rer setup`. Its setup field uses the same `secret`
kind, managed input and hex generator as `SESSION_SECRET`. `deploy.json` maps it
to the same-named private environment input; the delivery packaging and generated
deployment spec declare it in `secretNames`. Both the dependency and auth
adapters read it from the Worker environment. It is never stored in D1, R2,
source, test output or an archive.

Keep local custody in the private setup settings and hosted custody in the
owned 0600 deployment secrets file. Preserve these files securely when moving
checkouts. Use `rer deploy --rotate-secret INSTALLATION_KEY` for rotation;
`INSTALLATION_KEY_PREVIOUS` is optional and managed only during rotation or an
explicit retired-key reopen. Retain retired custody for backups and D1 recovery
points that still need it. See `vendor/base/dependencies/README.md` for recovery,
retirement and the sealing-capable rollback boundary. Do not replace a missing
key with a newly generated value on an existing installation.

Verification binds a per-run generated key through the contained module
`tests/agent-door/installation-key.mjs`; Vitest likewise generates fresh custody
for each worker runtime. No fixture key is committed. The shared door's
`verification.network.secretSource` declaration is a contained accessor module
path, as documented in `vendor/base/agent-door/ADOPTING.md`; it is not a place
for literal credentials. Vector's declared door currently needs no network
secret accessor. Keep any future secretSource example on its own line, without
secret-named assignments beside its quoted module path.
