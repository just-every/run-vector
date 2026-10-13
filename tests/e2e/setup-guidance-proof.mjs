import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
import {
  initializeProofBinding,
  assertProofBinding,
  auditProofState,
  proofAuditResults,
} from "./ui-proof-state.mjs";
import {
  assertSetupGuidance,
  preferencesRead,
  toggleEmailPreference,
} from "./setup-guidance-controls.mjs";
import { setupGuidanceRuntime } from "./setup-guidance-runtime.mjs";
import {
  requestLink,
  confirmNative,
  inviteNative,
  eligibleAssignment,
} from "./setup-guidance-mail.mjs";

const directory = resolve(verificationDirectory, "review-proof");
await mkdir(directory, { recursive: true });
const binding = await initializeProofBinding();
const runtime = await setupGuidanceRuntime();
const results = [],
  modes = [];
let browser;
try {
  const migrations = await runtime.initialize();
  console.info(
    JSON.stringify({
      phase: "schema",
      status: "initialized",
      count: migrations,
    }),
  );
  await runtime.start("local-available");
  browser = await chromium.launch({ headless: true });
  const newPage = async () => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { "CF-Connecting-IP": "127.0.0.1" },
    });
    return context.newPage();
  };
  let owner = await newPage(),
    peer = await newPage();
  assert.equal(
    (await owner.request.get(runtime.base + "/health")).status(),
    200,
  );
  await confirmNative(
    owner,
    await requestLink(owner, browser, runtime.base, "sarah@vector.test"),
    runtime,
  );
  await inviteNative(owner, peer, browser, runtime);
  const original = (await preferencesRead(owner)).emailEnabled;
  assert.equal(original, true);
  async function widths(mode, emailAvailable, emailEnabled, toggle = false) {
    for (const width of [1440, 390]) {
      const name = `${width}-setup-${mode}`;
      await owner.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await owner.goto(runtime.base + "/app/settings");
      await assertSetupGuidance(owner, { emailAvailable, emailEnabled });
      if (toggle) {
        await toggleEmailPreference(owner, false);
        await auditProofState(owner, name + "-off");
        await toggleEmailPreference(owner, true);
      }
      await auditProofState(owner, name);
      results.push({ name, passed: true });
    }
  }
  await widths("local-available", true, original, true);
  modes.push({
    mode: "local-available",
    migrations,
    emailAvailable: true,
    event: await eligibleAssignment(owner, peer, browser, runtime, true),
  });
  // Keep the native sessions and database; changing deployment configuration must
  // not rewrite preferences or installation ownership.
  await owner.goto("about:blank");
  await peer.goto("about:blank");
  await runtime.stop();
  await runtime.start("local-disabled");
  await widths("local-disabled", false, original);
  modes.push({
    mode: "local-disabled",
    emailAvailable: false,
    event: await eligibleAssignment(owner, peer, browser, runtime, false),
  });
  const changed = await owner.request.patch(
    runtime.base + "/api/settings/notifications",
    {
      headers: { Origin: runtime.base },
      data: { emailEnabled: false },
    },
  );
  assert.equal(changed.status(), 200);
  await owner.reload();
  await assertSetupGuidance(owner, {
    emailAvailable: false,
    emailEnabled: false,
  });
  // Base signs link tokens independently of mail mode. Issue native links through
  // local capture, stop the process, then actually confirm under hosted config.
  const ownerLink = await requestLink(
    owner,
    browser,
    runtime.base,
    "sarah@vector.test",
  );
  const peerLink = await requestLink(
    peer,
    browser,
    runtime.base,
    "recipient@setup.test",
  );
  await owner.context().close();
  await peer.context().close();
  await runtime.stop();
  await runtime.start("hosted-disabled");
  owner = await newPage();
  peer = await newPage();
  await confirmNative(owner, ownerLink, runtime, true);
  await confirmNative(peer, peerLink, runtime, true);
  await widths("hosted-disabled", false, false);
  assert.equal(
    (await owner.request.get(runtime.base + "/__dev/outbox")).status(),
    404,
  );
  modes.push({
    mode: "hosted-disabled",
    emailAvailable: false,
    nativeHttpsConfirmation: true,
    event: await eligibleAssignment(owner, peer, browser, runtime, false),
  });
  await owner.goto("about:blank");
  await peer.goto("about:blank");
  await runtime.stop();
  await runtime.start("hosted-incomplete");
  const request = await owner.request.post(runtime.base + "/auth/request", {
    headers: { Origin: runtime.base },
    data: { email: "sarah@vector.test", returnTo: "/app" },
  });
  assert.equal(request.status(), 503);
  const settings = await owner.request.get(runtime.base + "/api/settings");
  assert.equal(settings.status(), 503);
  assert.equal((await settings.json()).error, "MAIL_FROM_required");
  const deniedPage = await owner.goto(runtime.base + "/app/settings");
  assert.ok(
    deniedPage.status() >= 400 || new URL(owner.url()).pathname === "/signin",
  );
  assert.equal(
    await owner.getByRole("region", { name: "Operators", exact: true }).count(),
    0,
  );
  const anonymous = await newPage();
  const anonymousSettings = await anonymous.request.get(
    runtime.base + "/api/settings",
  );
  assert.equal(anonymousSettings.status(), 401);
  await anonymous.goto(runtime.base + "/app/settings");
  assert.equal(new URL(anonymous.url()).pathname, "/signin");
  await anonymous.context().close();
  modes.push({
    mode: "hosted-incomplete",
    authStatus: request.status(),
    settingsStatus: settings.status(),
    privatePageStatus: deniedPage.status(),
    anonymousSettingsStatus: anonymousSettings.status(),
    privatePageExposed: false,
  });
  await owner.context().close();
  await peer.context().close();
  // Restore the original preference through the genuine public control after
  // restoring availability, proving the disabled mode retained the saved value.
  await runtime.stop();
  await runtime.start("local-available");
  owner = await newPage();
  await confirmNative(
    owner,
    await requestLink(owner, browser, runtime.base, "sarah@vector.test"),
    runtime,
  );
  await owner.goto(runtime.base + "/app/settings");
  await assertSetupGuidance(owner, {
    emailAvailable: true,
    emailEnabled: false,
  });
  await toggleEmailPreference(owner, original);
  assert.equal(
    runtime.attempts(),
    0,
    "Worker outbound observer saw no external requests in any mode",
  );
  await assertProofBinding();
  await writeFile(
    resolve(directory, "setup-modes.json"),
    JSON.stringify(
      {
        binding,
        modes,
        outboundAttempts: runtime.attempts(),
        originalPreferenceRestored: true,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await writeFile(
    resolve(directory, "audits.json"),
    JSON.stringify({ binding, results: proofAuditResults }, null, 2),
  );
  await writeFile(
    resolve(directory, "regressions.json"),
    JSON.stringify(results, null, 2),
  );
  console.info(
    JSON.stringify({
      setupGuidance: "passed",
      modes: modes.map(({ mode }) => mode),
      checks: results.length,
      audits: proofAuditResults.length,
      outboundAttempts: runtime.attempts(),
    }),
  );
} finally {
  if (browser) await browser.close();
  await runtime.stop();
}
