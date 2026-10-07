# Vector authentication and mail

The production HTTP, document and Start server-function guards use maintained
Base `operator-auth` runtime source at `vendor/base/operator-auth`, retained from
Base `8556679074cf47fed64648235bda4447ee16e2fb`. Public documentation is maintained
in this edition; the current source lock records the effective files. The Base mail facade
at `vendor/base/mail` uses SendGrid's remote API. These are server imports; no
credentials or server implementation belong in browser bundles.

Configure `APP_ORIGIN` as the deployment's exact HTTPS origin,
`FIRST_OWNER_EMAIL` and the existing explicit first-owner/workspace/team fields,
`SESSION_SECRET` (a random secret of at least 32 characters),
`MAIL_PROVIDER=sendgrid`, `MAIL_FROM` (a verified sender), and secret `MAIL_API_KEY`.
`MAIL_MODE=sendgrid` may describe that deployment; it must never be
`local-outbox` remotely. There is no provider substitution, automatic retry,
unknown-email provisioning or session fallback. Missing configuration names its
missing field. Failed/rejected/rate-limited/uncertain mail revokes the issued
link and reports `mail_unavailable`; submitting again creates a new link.
Provider acceptance is not proof of inbox delivery.

`POST /auth/request` preserves the sign-in page's API and delegates to the Base
magic-link HTTP adapter. `POST /auth/magic-link` is the canonical Base endpoint.
Both enforce the existing five requests per IP per fifteen minutes, in addition
to Base's durable per-email and endpoint limits. The provider sends
`/auth/confirm?token=...`. GET/HEAD display a confirmation form without consuming
the link, writing a session or setting a cookie; the native form POST consumes
it once and redirects to the stored safe return path. Production cookies use
`__Host-operator_session`, HttpOnly, SameSite=Lax and Secure. Sessions expire
without silently sliding. `POST /auth/signout` revokes the current Base session
and preserves Vector's JSON signout response.

Settings' `POST /api/settings/operators/invite` requires an admitted operator,
its current session, exact Origin, and validated name/email. It always issues
Vector's equal-operator authority; callers cannot choose roles. All operators
internally use Base's owner role, so Base's last-active-owner constraint also
protects Vector's last operator. Raw Base bootstrap, invitation, role and status
HTTP routes are not mounted. Product removal remains the only application
operator-deactivation path, preserving the setup-owner self-removal restriction
and the entire OPS-004 transaction. Base's public bootstrap method is not used:
Vector already provisions a configured first owner and full workspace together.

## Additive import and identity mapping

Migration `0011_base_operator_auth.sql` adds Base's unchanged `oa_*` schema and a
`vector_auth_operators` mapping. It explicitly imports existing product
operators with their IDs, normalized emails, active/removed state and creation
timestamps, and claims the Base bootstrap ledger. It does not rewrite any
previous migration, product row, native credential history, issue, team or
workspace. Existing native sessions/links remain historical data and do not
admit a production request; existing operators request a new Base link.

The product insertion trigger integrates the existing atomic first-owner
bootstrap (one team and seven categories) without a second provisioning path.
Accepted Base invitations receive a product ULID and mapping only after Base
confirms the credential, with a persisted active-authority recheck. Repeated
admission never creates another product operator. An invitation stays outside
the active Settings operator list until accepted.

Every product mutation carries Base's validated session ID and operator version
into the existing D1 transaction guard. The guard checks the mapped product
operator, live Base session, expiry, active authority and version in the same
transaction as the operation. Product removal atomically revokes all mapped
Base sessions, that operator's links and their outstanding issued invitations,
anonymizes Base identity fields and changes status/version. A failed removal
rolls all of that back with product transfers and history changes.

Recovery is forward-only: retain 0001–0011 and the mapping/auth tables when
restoring a backup. Never roll back to a production build that admits historical
`vector_session` cookies. Rotate the session secret if all Base sessions and
links must be invalidated; this does not erase the workspace or migration data.

## Explicit local compatibility

Existing synthetic tests and local-review clients use a documented old native
credential dialect: `vector_session`, `/auth/request` with a `/auth/consume`
GET callback, and local `magic_links`/`operator_sessions` fixture rows. It is
admitted only in historical local configuration without `SESSION_SECRET`, with
`MAIL_MODE=local-outbox`, when the configured origin is literal
localhost, 127.0.0.1, IPv6 loopback, or the reserved synthetic `vector.test` host.
It still verifies the real stored token, expiry, revocation, removal and complete
application transaction fences. It creates no success substitute and never
admits a remote deployment. Its outbox delivery now also uses the real Base
`createMailSender` development provider with explicit D1 outbox storage.

For a local test of the new production authentication mechanism, configure the
same explicit Base fields, a literal loopback origin and `MAIL_MODE=local-outbox`,
and use the ordinary `/signin` page (`/auth/request`) or `/auth/magic-link`.
Supplying `SESSION_SECRET` selects Base for the whole local user journey. The Base local cookie is
`operator_session_local`, the outbox holds the canonical `/auth/confirm` URL,
and confirmation requires POST. The development facade stores mail in
`local_mail_outbox`; there is no public outbox route or email forwarding.
Local outbox credentials and content are sensitive. Neither the compatibility
suite nor mocked provider responses establish hosted provider delivery.
