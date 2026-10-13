import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { createUlid } from "../../src/core/shared/ids";
import { mentionToken } from "../../src/core/features/notifications/mention-token";
contractWith(
  it,
  "NOTIFY-001 NOTIFY-006 BASE-OPS-005",
  "native source dispatch bypasses old backlog and immediately captures all 99 recipients at workspace capacity",
  async () => {
    const f = await collaborationFixture();
    for (let i = 0; i < 21; i++)
      await f.pending({ title: `Older pending ${i}` });
    expect(await count("notification_deliveries", "status='pending'")).toBe(21);
    await f.create({
      title: "Immediate new assignment",
      assigneeOperatorId: f.bob,
    });
    expect(await count("notification_deliveries", "status='pending'")).toBe(21);
    expect(
      await count(
        "notification_deliveries",
        "title='Immediate new assignment' AND status='development'",
      ),
    ).toBe(1);
    const workspace = await env.DB.prepare(
      "SELECT workspace_id FROM operators WHERE id=?",
    )
      .bind(f.owner)
      .first<string>("workspace_id");
    const ids = [f.bob, f.cara],
      at = new Date().toISOString(),
      writes: D1PreparedStatement[] = [];
    for (let n = 0; n < 97; n++) {
      const id = createUlid(new Date());
      ids.push(id);
      writes.push(
        env.DB.prepare(
          "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        ).bind(
          id,
          workspace,
          `Mention recipient ${n}`,
          `${id}@fanout.test`,
          at,
          at,
        ),
      );
    }
    await env.DB.batch(writes);
    const issue = await f.create({
      title: "Every selected recipient",
      description: ids
        .map((id, n) => mentionToken({ id, name: `Recipient ${n}` }))
        .join(" "),
    });
    expect(await count("notifications", "issue_id=?", [issue.id])).toBe(99);
    expect(
      await count(
        "notification_deliveries",
        "title='Every selected recipient' AND status='development'",
      ),
    ).toBe(99);
    expect(await count("notification_development_mail")).toBe(100);
    expect(await count("notification_deliveries", "status='pending'")).toBe(21);
  },
);
