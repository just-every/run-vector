import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { setupAdministration, beforeBatch } from "./administration-fixture";
import { createUlid } from "../../src/core/shared/ids";
import { updateIssueRecord } from "../../src/core/features/issue-edit/repository";
import { removeLabel } from "../../src/core/features/administration/labels";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
const check = (ids: string, name: string, run: () => Promise<void>) =>
  contractWith(it, ids, name, run);
check(
  "ISSUE-014 ISSUE-007",
  "label deletion updates each issue and every private/shared native filter without erasing custom predicates",
  async () => {
    const f = await setupAdministration();
    let data = await f.mutate("/settings/labels", "POST", {
      name: "Customer",
      color: "#234567",
    });
    const label = data.labels[0];
    data = await f.mutate("/settings/labels", "POST", {
      name: "Urgent",
      color: "#eeeeee",
    });
    const other = data.labels.find((l) => l.id !== label.id)!;
    expect(
      (
        await f.call("/settings/labels", "POST", {
          name: "Customer",
          color: "#123456",
        })
      ).status,
    ).toBe(409);
    expect(
      (await f.call("/settings/labels", "POST", { name: "Bad", color: "red" }))
        .status,
    ).toBe(400);
    await f.mutate("/settings/labels/" + label.id, "PATCH", {
      name: "Client",
      color: "#ffffff",
    });
    const first = await f.create({ labelIds: [label.id, other.id] }),
      second = await f.create({ labelIds: [label.id] });
    const otherOwner = createUlid(new Date()),
      at = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    )
      .bind(
        otherOwner,
        f.initial.workspace.id,
        "Other owner",
        "other-owner@example.test",
        at,
        at,
      )
      .run();
    for (const shared of [0, 1])
      await env.DB.prepare(
        "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,is_shared,filters_json,created_at,updated_at) VALUES(?,?,?,?,'issues',?,?,?,?)",
      )
        .bind(
          createUlid(new Date()),
          f.initial.workspace.id,
          shared ? f.owner : otherOwner,
          "View " + shared,
          shared,
          JSON.stringify({
            labelIds: [label.id, other.id],
            label: label.id,
            priority: "high",
            extension: { labelIds: [label.id] },
          }),
          new Date().toISOString(),
          new Date().toISOString(),
        )
        .run();
    const corrupt = createUlid(new Date());
    await env.DB.prepare(
      "INSERT INTO saved_views(id,workspace_id,owner_operator_id,name,surface,filters_json,created_at,updated_at) VALUES(?,?,?,'Corrupt','issues','{',?,?)",
    )
      .bind(
        corrupt,
        f.initial.workspace.id,
        f.owner,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
    expect(
      (await f.call("/settings/labels/" + label.id, "DELETE")).status,
    ).toBe(409);
    expect(
      (await env.DB.prepare("SELECT version FROM issues WHERE id=?")
        .bind(first.id)
        .first())!.version,
    ).toBe(1);
    await env.DB.prepare("DELETE FROM saved_views WHERE id=?")
      .bind(corrupt)
      .run();
    await env.DB.prepare(
      `CREATE TRIGGER reject_label_delete BEFORE DELETE ON labels WHEN OLD.id='${label.id}' BEGIN SELECT RAISE(ABORT,'test label failure'); END`,
    ).run();
    await expect(removeLabel(env.DB, f.owner, label.id)).rejects.toThrow(
      /test label failure/,
    );
    expect(
      (await env.DB.prepare("SELECT version FROM issues WHERE id=?")
        .bind(first.id)
        .first())!.version,
    ).toBe(1);
    await env.DB.prepare("DROP TRIGGER reject_label_delete").run();
    await expect(
      removeLabel(
        beforeBatch(() =>
          env.DB.prepare(
            "UPDATE labels SET name='Concurrent label name' WHERE id=?",
          )
            .bind(label.id)
            .run(),
        ),
        f.owner,
        label.id,
      ),
    ).rejects.toThrow(/conflicts/);
    expect(
      (await env.DB.prepare("SELECT version FROM issues WHERE id=?")
        .bind(first.id)
        .first())!.version,
    ).toBe(1);
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM audit_records WHERE action='label.removed'",
      ).first())!.n,
    ).toBe(0);
    await f.mutate("/settings/labels/" + label.id, "DELETE");
    for (const issue of [first, second])
      expect(
        (await env.DB.prepare("SELECT version FROM issues WHERE id=?")
          .bind(issue.id)
          .first())!.version,
      ).toBe(2);
    const activity = await env.DB.prepare(
      "SELECT previous_value_json,next_value_json FROM issue_activity WHERE issue_id=? AND kind='label.removed'",
    )
      .bind(first.id)
      .first<{ previous_value_json: string; next_value_json: string }>();
    expect(JSON.parse(activity!.previous_value_json).labelIds.sort()).toEqual(
      [label.id, other.id].sort(),
    );
    expect(JSON.parse(activity!.next_value_json)).toEqual({
      labelIds: [other.id],
    });
    for (const view of (
      await env.DB.prepare("SELECT filters_json FROM saved_views").all<{
        filters_json: string;
      }>()
    ).results)
      expect(JSON.parse(view.filters_json)).toEqual({
        labelIds: [other.id],
        priority: "high",
        extension: { labelIds: [label.id] },
      });
    expect(
      (await env.DB.prepare("SELECT count(*) n FROM issues").first())!.n,
    ).toBe(2);
    await env.DB.prepare("DELETE FROM issues WHERE id IN (?,?)")
      .bind(first.id, second.id)
      .run();
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM audit_records WHERE action='label.removed'",
      ).first())!.n,
    ).toBe(1);
  },
);
check(
  "ISSUE-014",
  "seed label limit governs create and update, duplicate IDs and foreign labels reject",
  async () => {
    const f = await setupAdministration(),
      ids: string[] = [];
    for (let i = 0; i < f.initial.labelsPerIssue + 1; i++) {
      const data = await f.mutate("/settings/labels", "POST", {
        name: "Label " + i,
        color: "#777777",
      });
      ids.push(data.labels.find((l) => l.name === "Label " + i)!.id);
    }
    const issue = await f.create({
      labelIds: ids.slice(0, f.initial.labelsPerIssue),
    });
    expect(
      (
        await f.call("/issues", "POST", {
          title: "Overflow",
          teamId: f.initial.teams[0].id,
          labelIds: ids,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 1,
          labelIds: ids,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 1,
          labelIds: [ids[0], ids[0]],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 1,
          labelIds: [createUlid(new Date())],
        })
      ).status,
    ).toBe(400);
    const foreignWorkspace = createUlid(new Date()),
      foreignLabel = createUlid(new Date()),
      at = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES(?,?,?,?,?)",
    )
      .bind(foreignWorkspace, "Foreign workspace", "UTC", at, at)
      .run();
    await env.DB.prepare(
      "INSERT INTO labels(id,workspace_id,name,color,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    )
      .bind(foreignLabel, foreignWorkspace, "Foreign label", "#123456", at, at)
      .run();
    await expect(
      updateIssueRecord(env.DB, issue.identifier, f.owner, {
        expectedVersion: 1,
        labelIds: [foreignLabel],
      }),
    ).rejects.toThrow(/workspace/);
    await expect(removeLabel(env.DB, f.owner, foreignLabel)).rejects.toThrow(
      /unavailable/,
    );
    await env.DB.prepare("DELETE FROM labels WHERE id=?")
      .bind(foreignLabel)
      .run();
    await env.DB.prepare("DELETE FROM workspace_settings WHERE id=?")
      .bind(foreignWorkspace)
      .run();
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 1,
          labelIds: ids.slice(1),
        })
      ).status,
    ).toBe(200);
  },
);
check(
  "PROJ-001 PROJ-002 PROJ-009",
  "project lead, date, manual lifecycle and archive guards preserve existing membership",
  async () => {
    const f = await setupAdministration();
    expect(
      (await f.call("/settings/projects", "POST", { name: "No lead" })).status,
    ).toBe(400);
    expect(
      (
        await f.call("/settings/projects", "POST", {
          name: "Invalid date",
          leadOperatorId: f.owner,
          targetDate: "2026-02-30",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/settings/projects", "POST", {
          name: "Invalid lead",
          leadOperatorId: createUlid(new Date()),
        })
      ).status,
    ).toBe(409);
    const project = (
      await f.mutate("/settings/projects", "POST", {
        name: "Launch",
        description: "**Markdown**",
        leadOperatorId: f.owner,
        targetDate: "2026-11-20",
      })
    ).projects[0];
    expect(project.lifecycle).toBe("planned");
    expect(
      (
        await f.call("/settings/projects", "POST", {
          name: "Launch",
          leadOperatorId: f.owner,
        })
      ).status,
    ).toBe(409);
    const issue = await f.create({ projectId: project.id });
    await f.mutate("/settings/projects/" + project.id, "PATCH", {
      lifecycle: "active",
    });
    await f.mutate("/settings/projects/" + project.id, "PATCH", {
      archived: true,
    });
    expect(
      (
        await f.call("/issues", "POST", {
          title: "No join",
          teamId: f.initial.teams[0].id,
          projectId: project.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 1,
          title: "Retained membership",
          projectId: project.id,
        })
      ).status,
    ).toBe(200);
    expect(
      ((await (await f.call("/projects")).json()) as { projects: unknown[] })
        .projects,
    ).toHaveLength(0);
    expect(
      (
        (await (await f.call("/projects?includeArchived=true")).json()) as {
          projects: unknown[];
        }
      ).projects,
    ).toHaveLength(1);
    await f.mutate("/settings/projects/" + project.id, "PATCH", {
      archived: false,
    });
    const input = createIssueInputSchema.parse({
      teamId: f.initial.teams[0].id,
      title: "Project archive race",
      projectId: project.id,
    });
    let batches = 0;
    const raced = new Proxy(env.DB, {
      get(target, key) {
        if (key === "batch")
          return async (statements: D1PreparedStatement[]) => {
            if (++batches === 2)
              await env.DB.prepare(
                "UPDATE projects SET archived_at=? WHERE id=?",
              )
                .bind(new Date().toISOString(), project.id)
                .run();
            return target.batch(statements);
          };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await expect(
      createIssueRecord(raced, {
        actorOperatorId: f.owner,
        input,
        now: new Date(),
      }),
    ).rejects.toThrow(/unavailable/);
    expect(
      await env.DB.prepare(
        "SELECT id FROM issues WHERE title='Project archive race'",
      ).first(),
    ).toBeNull();
    await f.mutate("/settings/projects/" + project.id, "PATCH", {
      archived: false,
    });
    const completed = f.initial.teams[0].statuses.find(
      (s) => s.category === "completed",
    )!;
    expect(
      (
        await f.call("/issues/" + issue.identifier, "PATCH", {
          expectedVersion: 2,
          statusId: completed.id,
        })
      ).status,
    ).toBe(200);
    expect((await f.state()).projects[0].lifecycle).toBe("active");
    await f.mutate("/settings/projects/" + project.id, "PATCH", {
      lifecycle: "completed",
    });
    const entry = await env.DB.prepare(
      "SELECT actor_operator_id,previous_value_json,next_value_json FROM project_activity WHERE project_id=? AND kind='project.updated' ORDER BY rowid DESC LIMIT 1",
    )
      .bind(project.id)
      .first<{
        actor_operator_id: string;
        previous_value_json: string;
        next_value_json: string;
      }>();
    expect(entry!.actor_operator_id).toBe(f.owner);
    expect(JSON.parse(entry!.previous_value_json).lifecycle).toBe("active");
    expect(JSON.parse(entry!.next_value_json).lifecycle).toBe("completed");
  },
);
