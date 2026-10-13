import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import {
  assignmentStatements,
  mentionStatements,
  finalizeEvent,
} from "../../src/core/features/notifications/events";
import { configureNotifications } from "../../src/core/features/notifications/context";
import { bindings, request } from "./base-auth-fixture";
import { changePreferences } from "../../src/core/features/notifications/mutations";
import { drainNotificationMail } from "../../src/core/features/notifications/mail";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
contractWith(
  it,
  "NOTIFY-003 NOTIFY-004 NOTIFY-006",
  "finalized event identity prevents suppressed-event backfill on replay and actor signout does not cancel committed mail",
  async () => {
    const f = await collaborationFixture(),
      token = mentionToken({ id: f.bob, name: "Bob" });
    await changePreferences(env.DB, f.bob, {
      mutedKinds: ["assignment", "mention"],
    });
    const issue = await f.create({
      assigneeOperatorId: f.bob,
      description: token,
    });
    expect(await count("notifications")).toBe(0);
    expect(await count("notification_deliveries")).toBe(0);
    const activity = await env.DB.prepare(
      "SELECT id,created_at FROM issue_activity WHERE issue_id=? AND kind='issue.created'",
    )
      .bind(issue.id)
      .first<{ id: string; created_at: string }>();
    await changePreferences(env.DB, f.bob, { mutedKinds: [] });
    configureNotifications(env.DB, bindings);
    const event = {
      id: activity!.id,
      issueId: issue.id,
      actor: f.owner,
      at: activity!.created_at,
    };
    await env.DB.batch([
      ...assignmentStatements(env.DB, event, f.bob),
      ...mentionStatements(env.DB, event, token),
      ...finalizeEvent(env.DB, event),
    ]);
    expect(await count("notifications")).toBe(0);
    expect(await count("notification_deliveries")).toBe(0);
    await f.pending();
    expect((await request("/auth/signout", "POST", {}, f.cookie)).status).toBe(
      200,
    );
    await drainNotificationMail(bindings);
    expect(await count("notification_deliveries", "status='development'")).toBe(
      1,
    );
    expect(await count("notification_development_mail")).toBe(1);
  },
);
