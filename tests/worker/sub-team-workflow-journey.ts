import {env} from "cloudflare:workers";
import {expect} from "vitest";
import {roleWorkspace,resetLimits,snapshot} from "./role-fixture";
import {applyD1Migrations} from "cloudflare:test";
import {inject} from "vitest";
import {createVectorArchive} from "../../src/core/features/data/archive-service.mjs";
import {readArchive} from "@runeditrun/rer/modules/portability";
import {changeHierarchy} from "../../src/core/features/sub-teams/hierarchy";
import {beforeBatch} from "./administration-fixture";
import {team,current,shape,change} from "./sub-team-fixture";
export async function subTeamHierarchy() {
  const w = await roleWorkspace(),
    parent = w.team;
  const a = await team(w, "synthetic-vector-6001", "SUBA", parent.id),
    b = await team(w, "synthetic-vector-6002", "SUBB", parent.id);
  expect(a.parentTeamId).toBe(parent.id);
  expect(a.members).toEqual([{ operatorId: w.owner, role: "owner" }]);
  expect(shape(a)).toEqual(shape(parent));
  expect(shape(b)).toEqual(shape(parent));
  const work = await w.create({ teamId: a.id, title: "synthetic-vector-6003" });
  const root = await team(w, "synthetic-vector-6004", "SUBROOT");
  const grand = await team(w, "synthetic-vector-6005", "SUBG", a.id);
  const before = await snapshot([
    "teams",
    "workflow_statuses",
    "issues",
    "audit_records",
  ]);
  expect((await change(w, parent.id, { parentTeamId: grand.id })).status).toBe(
    400,
  );
  expect(
    (
      await w.call("/settings/teams", "POST", {
        name: "synthetic-vector-6006",
        identifierPrefix: "SUBDEEP",
        parentTeamId: grand.id,
      })
    ).status,
  ).toBe(400);
  expect((await change(w, a.id, { parentTeamId: b.id })).status).toBe(400);
  expect(
    await snapshot(["teams", "workflow_statuses", "issues", "audit_records"]),
  ).toEqual(before);
  expect((await change(w, a.id, { parentTeamId: root.id })).status).toBe(200);
  expect(
    ((await (await w.call("/issues/" + work.identifier)).json()) as any)
      .identifier,
  ).toBe("SUBA-1");
  expect((await current(w, a.id)).identifierPrefix).toBe("SUBA");
  expect((await change(w, a.id, { parentTeamId: parent.id })).status).toBe(200);
  const stale = (await current(w, a.id)).hierarchyVersion;
  expect(
    (await change(w, a.id, { workflowInherited: false }, w.admin, "api"))
      .status,
  ).toBe(200);
  const unchanged = await snapshot([
    "teams",
    "workflow_statuses",
    "issues",
    "audit_records",
  ]);
  expect(
    (
      await w.call(`/settings/teams/${a.id}/hierarchy`, "PUT", {
        version: stale,
        workflowInherited: true,
      })
    ).status,
  ).toBe(409);
  expect(
    await snapshot(["teams", "workflow_statuses", "issues", "audit_records"]),
  ).toEqual(unchanged);
  const aStatus = (await current(w, a.id)).statuses.find(
    (s) => s.category === "backlog",
  )!;
  expect(
    (
      await w.call(`/settings/teams/${a.id}/statuses/${aStatus.id}`, "PATCH", {
        name: "Child backlog",
      })
    ).status,
  ).toBe(200);
  expect(
    (await current(w, parent.id)).statuses.find(
      (s) => s.category === "backlog",
    )!.name,
  ).toBe("Backlog");
  expect(
    (await current(w, b.id)).statuses.find((s) => s.category === "backlog")!
      .name,
  ).toBe("Backlog");
  expect(
    (await current(w, grand.id)).statuses.find((s) => s.category === "backlog")!
      .name,
  ).toBe("Child backlog");
  expect(
    (
      await w.call(`/settings/teams/${b.id}/statuses`, "POST", {
        name: "No implicit override",
        category: "backlog",
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await w.call(`/settings/teams/${parent.id}/statuses`, "POST", {
        name: "Waiting",
        category: "backlog",
      })
    ).status,
  ).toBe(200);
  const p = await current(w, parent.id),
    waiting = p.statuses.find((s) => s.name === "Waiting")!;
  const childWaiting = (await current(w, b.id)).statuses.find(
    (s) => s.name === "Waiting",
  )!;
  expect(
    (await current(w, a.id)).statuses.some((s) => s.name === "Waiting"),
  ).toBe(false);
  const inheritedWork = await w.create({
    teamId: b.id,
    title: "synthetic-vector-6007",
    statusId: childWaiting.id,
  });
  expect(
    (
      await w.call(
        `/settings/teams/${parent.id}/statuses/${waiting.id}`,
        "PATCH",
        { name: "Awaiting" },
      )
    ).status,
  ).toBe(200);
  expect(
    (await current(w, b.id)).statuses.find((s) => s.id === childWaiting.id)!
      .name,
  ).toBe("Awaiting");
  const order = [...p.statuses].reverse().map((s) => s.id);
  expect(
    (
      await w.call(`/settings/teams/${parent.id}/statuses/order`, "PUT", {
        statusIds: order,
      })
    ).status,
  ).toBe(200);
  expect(shape(await current(w, b.id))).toEqual(
    shape(await current(w, parent.id)),
  );
  const destination = (await current(w, parent.id)).statuses.find(
    (s) => s.category === "backlog" && s.id !== waiting.id,
  )!;
  expect(
    (
      await w.call(
        `/settings/teams/${parent.id}/statuses/${waiting.id}`,
        "DELETE",
        { destinationStatusId: destination.id },
      )
    ).status,
  ).toBe(200);
  const after = (await (
    await w.call("/issues/" + inheritedWork.identifier)
  ).json()) as any;
  expect(after.status.name).toBe(destination.name);
  expect(after.status.category).toBe("backlog");
  expect(
    (await current(w, b.id)).statuses.some((s) => s.id === childWaiting.id),
  ).toBe(false);
  expect(
    (await current(w, a.id)).statuses.find((s) => s.id === aStatus.id)!.name,
  ).toBe("Child backlog");
  expect((await change(w, a.id, { workflowInherited: true })).status).toBe(200);
  expect(shape(await current(w, a.id))).toEqual(
    shape(await current(w, parent.id)),
  );
  expect(shape(await current(w, grand.id))).toEqual(
    shape(await current(w, parent.id)),
  );
  expect(
    (
      await env.DB.prepare(
        "SELECT i.identifier FROM issues i LEFT JOIN workflow_statuses s ON s.id=i.status_id AND s.team_id=i.team_id WHERE s.id IS NULL",
      ).all()
    ).results,
  ).toEqual([]);
  expect(
    (await env.DB.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
  // A concurrent hierarchy edit cannot be overwritten after admission.
  const selected = await current(w, b.id);
  await expect(
    changeHierarchy(
      beforeBatch(async () => {
        await env.DB.prepare(
          "UPDATE teams SET hierarchy_version=hierarchy_version+1 WHERE id=?",
        )
          .bind(b.id)
          .run();
      }),
      w.owner,
      b.id,
      { version: selected.hierarchyVersion, workflowInherited: false },
    ),
  ).rejects.toThrow();
  expect((await current(w, b.id)).workflowInherited).toBe(true);
  const target = env.ARCHIVE_TARGET_DB;
  await applyD1Migrations(target, inject("migrations"));
  const source = await createVectorArchive({ db: env.DB, files: env.FILES });
  const importer = await createVectorArchive({
    db: target,
    files: env.ARCHIVE_TARGET_FILES,
  });
  const exported = await source.exports.create();
  while (
    (await source.exports.advance(exported, { maxParts: 16 })).phase ===
    "building"
  ) {}
  const records: any[] = [];
  for await (const record of readArchive(
    await source.exports.download(exported),
  ))
    records.push(record);
  await source.exports.abort(exported);
  const restored = await importer.imports.create(records[0]);
  for (const part of records.filter((row) => row.kind === "part"))
    await importer.imports.uploadPart(restored, part.index, part);
  await importer.imports.finalize(restored, {
    contentHash: records.at(-1).contentHash,
    archiveHash: records.at(-1).archiveHash,
  });
  for (const table of [
    "teams",
    "workflow_statuses",
    "issues",
    "team_members",
  ]) {
    const before = (
      await env.DB.prepare("SELECT * FROM " + table + " ORDER BY rowid").all()
    ).results;
    const after = (
      await target.prepare("SELECT * FROM " + table + " ORDER BY rowid").all()
    ).results;
    const key = (row: any) =>
      JSON.stringify(
        Object.entries(row).sort(([a], [b]) =>
          String(a).localeCompare(String(b)),
        ),
      );
    expect(after.map(key).sort(), table).toEqual(before.map(key).sort());
  }
  expect(
    (await target.prepare("PRAGMA foreign_key_check").all()).results,
  ).toEqual([]);
}

