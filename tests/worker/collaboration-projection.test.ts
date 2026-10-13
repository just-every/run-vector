import { afterNativeStatement } from './notification-session-fixture';
import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { createApiApp } from "../../src/core/app/api";
import { bindings, origin } from "./base-auth-fixture";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
for (const [path, phase] of [
  ["/issues", "projection"],
  ["/intake", "projection"],
  ["/issues", "mail"],
  ["/issues", "workspace"],
] as const)
  contractWith(
    it,
    "BASE-ACCESS-002 NOTIFY-006",
    `${path} ${phase} hides postcommit projections after native signout while immediately dispatching committed recipient mail`,
    async () => {
      const f = await collaborationFixture();
      const duringMail = phase !== "projection";
      const previousWorkspace = await env.DB.prepare(
        "SELECT workspace_id FROM operators WHERE id=?",
      )
        .bind(f.owner)
        .first<string>("workspace_id");
      const destination = "01J00000000000000000000779";
      if (phase === "workspace")
        await env.DB.prepare(
          "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,'Other','UTC','now','now')",
        )
          .bind(destination)
          .run();
      let fired = false;
      const db = afterNativeStatement(async query => {
        if (!fired && query.includes(duringMail ? 'INSERT INTO rer_mail_development_outbox' : 'SELECT id,actor_name FROM issue_activity')) {
          fired = true;
          if (phase === 'workspace') await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(destination,f.owner).run();
          else await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)').bind(Date.now(),f.owner).run();
        }
      });
      const response = await createApiApp().request(
        origin + path,
        {
          method: "POST",
          headers: {
            origin,
            host: new URL(origin).host,
            cookie: f.cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            title: "Private committed projection",
            teamId: f.initial.teams[0].id,
            description: mentionToken({ id: f.bob, name: "Bob" }),
          }),
        },
        { ...bindings, DB: db },
      );
      if (phase === "workspace") {
        await env.DB.prepare("UPDATE operators SET workspace_id=? WHERE id=?")
          .bind(previousWorkspace, f.owner)
          .run();
        await env.DB.prepare("DELETE FROM workspace_settings WHERE id=?")
          .bind(destination)
          .run();
      }
      expect(fired).toBe(true);
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain(
        "Private committed projection",
      );
      expect(
        await count(
          "notification_deliveries",
          "recipient_id=? AND status='development'",
          [f.bob],
        ),
      ).toBe(1);
      expect(
        await count(
          "notification_development_mail",
          "delivery_id IN(SELECT id FROM notification_deliveries WHERE recipient_id=?)",
          [f.bob],
        ),
      ).toBe(1);
    },
  );
