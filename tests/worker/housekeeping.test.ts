import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { readArchive } from "@runeditrun/rer/modules/portability";
import { contractWith } from "../contract-tags";
import { setupAdministration } from "./administration-fixture";
import { bindings } from "./base-auth-fixture";
import { scheduled } from "../../src/core/app/scheduled";

const tick = (at: Date) => scheduled({ scheduledTime: at.getTime() }, bindings);
// Synthetic history: move an issue's last activity (or its closing) into the past.
async function age(id: string, days: number, closed = false) {
  const at = new Date(Date.now() - days * 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE issues SET updated_at=?,created_at=?${closed ? ",completed_at=?" : ""} WHERE id=?`)
      .bind(...(closed ? [at, at, at, id] : [at, at, id])),
    env.DB.prepare("UPDATE issue_activity SET created_at=?,updated_at=? WHERE issue_id=?").bind(at, at, id),
  ]);
}

contractWith(
  it,
  "AUTO-003",
  "a scheduled run closes a 30-day stale issue and archives a 90-day completed one, each with an automation entry, as previewed",
  async () => {
    const f = await setupAdministration(), team = f.initial.teams[0];
    const status = (category: string) => team.statuses.find((s) => s.category === category)!.id;
    const bug = (await f.mutate("/settings/labels", "POST", { name: "Bug", color: "#d64545" })).labels.find((l) => l.name === "Bug")!;
    const stale = await f.create({ title: "Stale vendor follow-up", statusId: status("backlog") });
    const staleBug = await f.create({ title: "Stale checkout crash", statusId: status("backlog"), labelIds: [bug.id] });
    const fresh = await f.create({ title: "Fresh pricing question", statusId: status("backlog") });
    const done = await f.create({ title: "Shipped invoice export", statusId: status("completed") });
    await age(stale.id, 31); await age(staleBug.id, 31); await age(done.id, 91, true);

    const path = `/settings/teams/${team.id}/housekeeping`;
    const rule = { closeAfterDays: 30, archiveAfterDays: 90, exemptBugs: true };
    expect((await f.call(path, "PUT", { ...rule, closeAfterDays: 0 })).status).toBe(400);
    expect((await f.mutate(path, "PUT", rule)).housekeeping).toEqual([{ teamId: team.id, ...rule }]);
    const preview = await (await f.call(path + "/preview", "POST", rule)).json() as { close: { identifier: string }[]; archive: { identifier: string }[] };
    expect(preview.close.map((i) => i.identifier)).toEqual([stale.identifier]);
    expect(preview.archive.map((i) => i.identifier)).toEqual([done.identifier]);
    const unexempt = await (await f.call(path + "/preview", "POST", { ...rule, exemptBugs: false })).json() as typeof preview;
    expect(unexempt.close.map((i) => i.identifier).sort()).toEqual([stale.identifier, staleBug.identifier].sort());

    await tick(new Date());
    await tick(new Date());
    const read = async (identifier: string) =>
      (await (await f.call("/issues/" + identifier)).json()) as { status: { id: string }; archivedAt: string | null; activity: { kind: string; actor: string | null }[] };
    const closed = await read(stale.identifier), archived = await read(done.identifier);
    expect(closed.status.id).toBe(status("canceled"));
    expect(closed.activity.filter((a) => a.kind === "issue.auto_closed")).toEqual([expect.objectContaining({ actor: "Auto-close automation" })]);
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.activity.filter((a) => a.kind === "issue.auto_archived")).toEqual([expect.objectContaining({ actor: "Auto-archive automation" })]);
    for (const kept of [staleBug, fresh]) expect((await read(kept.identifier)).status.id).toBe(status("backlog"));

    // Archived issues leave lists and default search, stay findable and exported.
    const listed = async (query: string) =>
      ((await (await f.call("/issues?" + query)).json()) as { issues: { identifier: string }[] }).issues.map((i) => i.identifier);
    expect(await listed("category=completed")).not.toContain(done.identifier);
    expect(await listed("")).toContain(stale.identifier);
    const search = async (all: boolean) =>
      ((await (await f.call(`/search?q=${encodeURIComponent("Shipped invoice export")}&includeArchived=${all}`)).json()) as { issues: { identifier: string }[] }).issues.map((i) => i.identifier);
    expect(await search(false)).not.toContain(done.identifier);
    expect(await search(true)).toContain(done.identifier);
    const job = (await (await f.call("/portability/exports", "POST", {})).json() as { id: string }).id;
    let phase = "building";
    while (phase === "building") phase = ((await (await f.call(`/portability/exports/${job}/advance`, "POST", { maxParts: 16 })).json()) as { phase: string }).phase;
    const rows: string[] = [];
    for await (const row of readArchive((await f.call(`/portability/exports/${job}/download`)).body!)) rows.push(JSON.stringify(row));
    expect(rows.some((row) => row.includes(done.id) && row.includes(archived.archivedAt!))).toBe(true);

    // Choosing another status brings an archived issue back.
    const reopened = await f.call("/issues/" + done.identifier, "PATCH", { expectedVersion: (await (await f.call("/issues/" + done.identifier)).json() as { version: number }).version, statusId: status("started") });
    expect(reopened.status, await reopened.clone().text()).toBe(200);
    expect((await read(done.identifier)).archivedAt).toBeNull();
    expect(await listed("")).toContain(done.identifier);
  },
);
