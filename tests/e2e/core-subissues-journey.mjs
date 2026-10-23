import assert from "node:assert/strict";
import { request } from "@playwright/test";
import { beforePrivateNavigation } from "./collaboration-navigation.mjs";

export async function subissuesJourney(
  page,
  context,
  base,
  record = async () => {},
) {
  async function api(path, method = "GET", data) {
    // Earlier journeys leave keep-alive sockets in this context's request
    // pool, and the local Worker closes an idle socket after 5 s; a request
    // sent on one fails with "socket hang up" whatever its own Connection
    // header. Own and dispose a client per call, as the project risk journey
    // does, so no request reuses a pooled socket.
    const client = await request.newContext({
      storageState: await context.storageState(),
    });
    try {
      const response = await client.fetch(base + "/api" + path, {
        method,
        headers: { Origin: base },
        ...(data === undefined ? {} : { data }),
      });
      assert(response.ok(), `${method} ${path}: ${response.status()}`);
      return await response.json();
    } finally {
      await client.dispose();
    }
  }
  const visit = async (identifier) => {
    await beforePrivateNavigation(page, base + "/app/issues/" + identifier);
    await page.goto(base + "/app/issues/" + identifier);
  };
  async function changeStatus(identifier, statusId) {
    await visit(identifier);
    const response = page.waitForResponse(
      (r) =>
        r.url() === base + "/api/issues/" + identifier &&
        r.request().method() === "PATCH",
    );
    await page
      .getByRole("combobox", { name: "Issue status", exact: true })
      .selectOption(statusId);
    assert.equal((await response).status(), 200);
  }
  async function panel() {
    await page.waitForFunction(() =>
      document
        .querySelector('select[aria-label="Issue status"]')
        ?.matches(":enabled"),
    );
    const details = page.locator(".issue-subissues");
    await details.locator("summary").waitFor();
    if (!(await details.evaluate((e) => e.open)))
      await details.locator("summary").click();
    await details.getByLabel("New sub-issue title", { exact: true }).waitFor();
    return details;
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const prefix =
      "SP" +
      String(Date.now())
        .slice(-6)
        .replaceAll(/\d/g, (d) => String.fromCharCode(65 + Number(d)));
    const state = await api("/settings/teams", "POST", {
      name: `Payments delivery ${prefix}`,
      identifierPrefix: prefix,
    });
    const team = state.teams.find((t) => t.identifierPrefix === prefix),
      category = (name) => team.statuses.find((s) => s.category === name).id;
    await api("/settings", "PATCH", { timezone: "UTC" });
    await api("/settings/teams/" + team.id, "PATCH", {
      autoCycleCompleted: true,
    });
    const local = (days) =>
      new Date(Date.now() + days * 86400000).toISOString().slice(0, 16);
    const cycles = await api("/settings/cycles", "POST", {
      teamId: team.id,
      name: `Checkout recovery ${width}`,
      startsLocal: local(-1),
      endsLocal: local(6),
      capacity: 30,
    });
    const active = cycles.cycles.find((c) => c.teamId === team.id);
    const parent = await api("/issues", "POST", {
      teamId: team.id,
      title: "Ship resilient checkout recovery",
      description:
        "Complete gateway limits, retry coverage and rollout notes before releasing.",
    });
    await visit(parent.identifier);
    let section = await panel();
    for (const title of [
      "Add gateway timeouts",
      "Cover retry recovery",
      "Publish the rollout notes",
    ]) {
      await section
        .getByLabel("New sub-issue title", { exact: true })
        .fill(title);
      const created = page.waitForResponse(
        (r) =>
          r.url() ===
            base + "/api/issues/" + parent.identifier + "/subissues" &&
          r.request().method() === "POST",
      );
      await section
        .getByRole("button", { name: "Create sub-issue", exact: true })
        .click();
      assert.equal((await created).status(), 201);
      await section.getByRole("link", { name: new RegExp(title) }).waitFor();
    }
    let children = (await api("/issues/" + parent.identifier + "/subissues"))
      .children;
    const options = await api("/options");
    await api("/issues/" + children[0].identifier, "PATCH", {
      expectedVersion: children[0].version,
      assigneeOperatorId: options.operator.id,
    });
    const reordered = page.waitForResponse(
      (r) =>
        r.url() === base + "/api/issues/" + parent.identifier + "/subissues" &&
        r.request().method() === "PATCH",
    );
    await section
      .getByRole("button", {
        name: "Move " + children[2].identifier + " up",
        exact: true,
      })
      .click();
    assert.equal((await reordered).status(), 200);
    await section
      .getByText("Sub-issue order saved.", { exact: true })
      .waitFor();
    const ordered = await section
      .locator(".issue-subissues__list strong")
      .allTextContents();
    assert.deepEqual(ordered, [
      children[0].identifier,
      children[2].identifier,
      children[1].identifier,
    ]);
    const converted = page.waitForResponse(
      (r) =>
        r.url() ===
          base + "/api/issues/" + children[1].identifier + "/parent" &&
        r.request().method() === "PATCH",
    );
    await section
      .getByRole("button", {
        name: "Convert " + children[1].identifier + " to a root issue",
        exact: true,
      })
      .click();
    assert.equal((await converted).status(), 200);
    await section.getByText("0 of 2 completed", { exact: true }).waitFor();
    await section
      .getByLabel("Existing issue identifier", { exact: true })
      .fill(children[1].identifier);
    const attached = page.waitForResponse(
      (r) =>
        r.url() ===
          base + "/api/issues/" + children[1].identifier + "/parent" &&
        r.request().method() === "PATCH",
    );
    await section
      .getByRole("button", { name: "Add existing issue", exact: true })
      .click();
    assert.equal((await attached).status(), 200);
    await section.getByText("0 of 3 completed", { exact: true }).waitFor();
    const enabled = page.waitForResponse(
      (r) =>
        r.url() === base + "/api/teams/" + team.id + "/subissue-rule" &&
        r.request().method() === "PATCH",
    );
    await section
      .getByRole("checkbox", {
        name: "Complete and reopen parents automatically for this team",
      })
      .check();
    assert.equal((await enabled).status(), 200);
    await section
      .getByText("Team sub-issue rule updated.", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await record("ISSUE-019", `ordered-${width}`, page);
    for (const child of children)
      await changeStatus(child.identifier, category("completed"));
    await visit(parent.identifier);
    section = await panel();
    await section.getByText("3 of 3 completed", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("combobox", { name: "Issue status", exact: true })
        .inputValue(),
      category("completed"),
    );
    const done = await api("/issues/" + parent.identifier);
    assert.equal(done.cycle?.id, active.id);
    assert.equal(
      done.activity.filter((a) => a.kind === "issue.subissue_completed").length,
      1,
    );
    await record("ISSUE-019", `completed-${width}`, page);
    await changeStatus(children[0].identifier, category("unstarted"));
    await visit(parent.identifier);
    section = await panel();
    await section.getByText("2 of 3 completed", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("combobox", { name: "Issue status", exact: true })
        .inputValue(),
      category("unstarted"),
    );
    const reopened = await api("/issues/" + parent.identifier);
    assert.equal(
      reopened.activity.filter((a) => a.kind === "issue.subissue_reopened")
        .length,
      1,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await record("ISSUE-019", `reopened-${width}`, page);
  }
}
