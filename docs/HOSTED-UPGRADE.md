# Hosted upgrade from v0.1.0

v0.1.0's `pnpm run deploy` ran the reviewed artifact controller. In v0.2.0, `pnpm run deploy` runs `rer deploy`, whose default installation is `vector-projects-production`. It does not adopt a controller's existing resources. Preserve the original installation by using `pnpm artifact:deploy` instead. `pnpm artifact:health` replaces the old `pnpm run deploy:health`.

## Keep the original installation

1. Stop deployment automation and other writers for the upgrade window. Back up the old source/customizations, D1 records, private R2 file bytes, original reviewed JSON plan, artifact and controller receipt. Test matching source/data recovery in isolated resources before changing traffic.
2. Retain the exact account, `worker` and public configuration from the original reviewed plan. The controller derives the existing `<worker>-db`, `<worker>-files` and workers.dev origin from it. Do not rename any resource or create an empty installation as a substitute.
3. Update source and prepare a new artifact in a separate credential-free build job using [DEPLOY.md](../DEPLOY.md#buildcontroller-separation). Use the new committed source SHA, a new run identity, its independently obtained artifact digest, and a **new, nonexistent receipt filename**. Retain the old receipt as history; it belongs to the old artifact and cannot be reused for the new build.
4. In the trusted controller environment, select the same account/token and original `RER_DEPLOY_PLAN`, but supply the new `RER_DEPLOY_ARTIFACT`, `RER_DEPLOY_ARTIFACT_SHA256`, `RER_DEPLOY_SOURCE_SHA`, `RER_DEPLOY_RUN_ID`, `RER_DEPLOY_RUN_ATTEMPT` and `RER_DEPLOY_RECEIPT`. Then run:

   ```sh
   pnpm artifact:deploy
   pnpm artifact:health
   ```

   Keep credentials out of dependency/build commands. Existing opaque `SESSION_SECRET` and `MAIL_API_KEY` Worker secrets are inherited; do not rotate them during this upgrade. The artifact controller uses `CF_THROWAWAY_ACCOUNT_ID` / `CF_THROWAWAY_API_TOKEN`, not the owner-account deploy's credential input names.
5. The controller checks unchanged migration names/content, converts its original `_rer_deploy_migrations` ledger into the current tracked history, applies 0012–0049 in order and uploads the new Worker to the same installation. It adds the restore coordinator binding. Changed migration bytes, uncertain claims or configuration drift refuse rather than being repaired silently. **0046 deletes all pending identity-dependency approvals: owners must renew them.** Established links and product data remain. 0047 reserves reviewed issue-number ranges permanently; never rewind their high-water marks.
6. Sign in at the retained origin. Check existing issue identifiers, fields, comments, operator access and original attachment bytes, plus an anonymous attachment refusal. Keep the new receipt and backups. A repeat `pnpm artifact:deploy` with the identical new artifact/run/plan/receipt is a checked no-op; it is not another upgrade.

Compatible-source rollback retains the additive schema, new ledgers and erasure/import/file custody guards. Restore a matching backup into isolated resources for incompatible-source recovery; never replay historical mail or webhooks.

## Moving to the owner-account command

There is no controller-to-`rer deploy` adoption command in this release. Keep using the controller path above for an in-place upgrade. A separately named `rer deploy` installation is a migration to new resources: use an authenticated application archive and original files, restore into a pristine destination following [Archives](ARCHIVES.md), re-enter secrets, review access and held future effects, and validate it before changing traffic. Retain the old installation until the migration is accepted.

`rer deploy --remove --yes` removes only resources recorded as created by that command in `.rer/deploy`. It cannot remove or adopt an old controller installation. The artifact controller does not delete resources; any later retirement must use the provider's explicit deletion operations against the reviewed plan and verified resource IDs, including emptying private R2 files, followed by an independent empty-resource readback. Do not fabricate `.rer/deploy` ownership state from a controller receipt.

Managed relay delivery is not hosted-proven for this release: the Managed-relay-shaped sign-in/invitation proof is blocked by Base patch `gr-base-162`. Owner-account SendGrid delivery does not establish relay acceptance.
