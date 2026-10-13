import assert from "node:assert/strict";

// Recovery/sign-out proof owns a separate real session, preserving the caller's
// administration session and every record it already authored.
export async function signInRecoverySession(page, runtime) {
  const before = runtime.sql("SELECT count(*) n FROM oa_sessions")[0].n;
  await page.goto(runtime.base + "/signin");
  await page
    .getByLabel("Email", { exact: true })
    .fill(runtime.config.FIRST_OWNER_EMAIL);
  const sent = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/auth/request" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Send sign-in link", exact: true })
    .click();
  assert.equal((await sent).status(), 202);
  const link = runtime.sql(
    "SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox ORDER BY created_at DESC,sequence DESC LIMIT 1",
  )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
  await page.goto(link);
  assert.equal(
    runtime.sql("SELECT count(*) n FROM oa_sessions")[0].n,
    before,
    "confirmation GET does not create the recovery session",
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.waitForURL(runtime.base + "/app");
  assert.equal(
    runtime.sql("SELECT count(*) n FROM oa_sessions")[0].n,
    before + 1,
    "recovery uses its own genuine native session",
  );
}
