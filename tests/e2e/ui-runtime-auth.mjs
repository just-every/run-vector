import { confirmLink } from './outbox-session.mjs';
import assert from "node:assert/strict";
export async function signIn({ base, sql, req }) {
  const email = sql(
    "SELECT email FROM operators ORDER BY created_at LIMIT 1",
  )[0].email;
  const requested = await req("/auth/request", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, returnTo: "/app" }),
  });
  assert.equal(requested.status, 202);
  const url = sql(
    "SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox ORDER BY created_at DESC LIMIT 1",
  )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
  const signed = await confirmLink(url);
  assert.equal(signed.status, 303);
  const cookie = signed.headers.get("set-cookie").split(";")[0];
  const review = await req('/api/setup', { headers: { Cookie: cookie } });
  assert.equal(review.status, 200);
  const setup = await review.json();
  if (setup.owner && !setup.completed) {
    const completed = await req('/api/setup/complete', {
      method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).completed, true);
  }
  return { email, cookie };
}

export async function openAuthenticatedPage(browser, cookie, base) {
  const context = await browser.newContext();
  const split = cookie.indexOf("=");
  await context.addCookies([
    { name: cookie.slice(0, split), value: cookie.slice(split + 1), url: base },
  ]);
  const page = await context.newPage();
  return page;
}
