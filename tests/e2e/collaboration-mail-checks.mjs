import assert from "node:assert/strict";

/** Check disclosed data and the event's meaning, without pinning the email copy. */
export function checkNotificationMail(capture, { issue, operator, owner, base, privateValues }) {
  const mail = JSON.parse(capture.message);
  const { deliveryId, from, to, subject, text, ...extra } = mail;
  assert.equal(deliveryId, capture.delivery_id);
  assert.ok(from, "notification has a sender");
  assert.deepEqual(to, [operator.email], "only the intended recipient is addressed");
  assert.deepEqual(extra, {}, "notification has no HTML, attachments, tracking or extra payload fields");
  assert.equal(subject, `${issue.identifier}: ${issue.title}`);
  assert.equal(typeof text, "string");

  // Only the issue heading, readable actor, canonical link, sign-in guidance and
  // event reason may appear. Blank lines and the order of these parts are free.
  const remaining = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const take = (matches, label) => {
    const indices = remaining.flatMap((line, index) => matches(line) ? [index] : []);
    assert.equal(indices.length, 1, `one ${label} in the minimal body`);
    return remaining.splice(indices[0], 1)[0];
  };
  take(line => line === `${issue.identifier}: ${issue.title}`, "issue identifier and title");
  take(line => line.endsWith(owner.name) && /^(?:by|from|actor)\s*:?\s*$/i.test(line.slice(0, -owner.name.length)), "readable actor");
  const link = `${base}/app/issues/${issue.identifier}`;
  take(line => line === link, "authenticated issue link");
  assert.deepEqual(text.match(/https?:\/\/[^\s]+/g), [link], "no tracking or unrelated links");
  take(line => /^(?:sign|log) in\b/i.test(line) && /\b(?:view|open)\b.*\bissue\b/i.test(line), "sign-in guidance");
  assert.equal(remaining.length, 1, "only the event reason remains; no description, comment or evidence paragraph");

  const causes = JSON.parse(capture.causes_json);
  const reason = remaining[0];
  assert.equal(/\bassign(?:ed|ment)?\b/i.test(reason), causes.includes("assignment"), "assignment reason matches the notification event");
  assert.equal(/\bmention(?:ed)?\b/i.test(reason), causes.includes("mention"), "mention reason matches the notification event");
  assert.match(reason, /\byou\b/i, "reason explains why this recipient received the email");

  const serialized = JSON.stringify(mail);
  assert.doesNotMatch(serialized, /PRIVATE_DESCRIPTION_SENTINEL|PRIVATE_COMMENT_SENTINEL/);
  for (const value of privateValues.filter(Boolean))
    assert.ok(!serialized.includes(JSON.stringify(value).slice(1, -1)), "private issue and discussion content stays out of email");
  return causes.filter(cause => cause === "assignment" || cause === "mention");
}
