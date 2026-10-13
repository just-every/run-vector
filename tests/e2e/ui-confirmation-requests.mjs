import assert from "node:assert/strict";

// Observe native reads without intercepting their transport or their receipts.
function observeMembershipReads(page) {
  const reads = [],
    failures = [];
  const membershipPath = (request) => {
    const path = new URL(request.url()).pathname;
    return request.method() === "GET" &&
      ["/api/current", "/api/my-work"].includes(path)
      ? path
      : null;
  };
  const requested = (request) => {
    const path = membershipPath(request);
    if (path) reads.push(path);
  };
  const failed = (request) => {
    const path = membershipPath(request);
    if (path) failures.push({ path, error: request.failure()?.errorText });
  };
  const responded = (response) => {
    const path = membershipPath(response.request());
    if (path && response.status() !== 200)
      failures.push({ path, status: response.status() });
  };
  page.on("request", requested);
  page.on("requestfailed", failed);
  page.on("response", responded);
  let offset = 0;
  return {
    async checkpoint(label, current, work) {
      await page.waitForLoadState("networkidle");
      const stage = reads.slice(offset);
      assert.deepEqual(
        failures,
        [],
        `${label}: no canceled or failed membership reads`,
      );
      assert.equal(
        stage.filter((path) => path === "/api/current").length,
        current,
        `${label}: Current reads`,
      );
      assert.equal(
        stage.filter((path) => path === "/api/my-work").length,
        work,
        `${label}: My work reads`,
      );
      offset = reads.length;
    },
    stop() {
      page.off("request", requested);
      page.off("requestfailed", failed);
      page.off("response", responded);
    },
  };
}

export async function exerciseConfirmationRequests({
  page,
  base,
  req,
  opts,
  headers,
}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForLoadState("networkidle");
  const observer = observeMembershipReads(page);
  const team = opts.teams[0];
  const status = (category) =>
    opts.statuses.find(
      (item) => item.teamId === team.id && item.category === category,
    );
  const create = async (title) => {
    const response = await req("/api/intake", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        teamId: team.id,
        summary: "Native confirmation lifecycle evidence",
      }),
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  const confirmation = page.getByRole("status", {
    name: "Saved triage decision",
  });
  const panel = page.locator(".decision-panel");
  const properties = page.locator(".issue-property-bar");
  const changeProperty = async (identifier, label, value) => {
    const mutation = page.waitForResponse(
      (response) =>
        response.url() === `${base}/api/issues/${identifier}` &&
        response.request().method() === "PATCH",
    );
    const current = page.waitForResponse(
      (response) =>
        response.url() === `${base}/api/current` &&
        response.request().method() === "GET",
    );
    await properties.getByLabel(label, { exact: true }).selectOption(value);
    assert.equal((await mutation).status(), 200);
    assert.equal((await current).status(), 200);
  };
  try {
    const issue = await create("Confirmation lifecycle: accepted completion");
    await page.goto(`${base}/app/issues/${issue.identifier}`);
    await page
      .getByRole("heading", { name: issue.title, exact: true })
      .waitFor();
    await observer.checkpoint("Undecided mount", 0, 0);
    assert.equal(await confirmation.count(), 0);

    await panel.getByRole("tab", { name: "Defer", exact: true }).click();
    await panel
      .getByLabel("Return for decision")
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await panel.getByLabel(/^Reason/).fill("Await another observation");
    await panel.getByRole("button", { name: "Defer decision" }).click();
    await confirmation.filter({ hasText: "Deferred" }).waitFor();
    await observer.checkpoint("Deferred version", 0, 0);
    await page.reload();
    await confirmation.filter({ hasText: "Deferred" }).waitFor();
    await observer.checkpoint("Deferred mount", 0, 0);

    await panel.getByRole("tab", { name: "End deferral", exact: true }).click();
    await panel.getByRole("button", { name: "End deferral now" }).click();
    await page.locator(".decision-confirmation--ended").waitFor();
    await observer.checkpoint("Ended deferral", 0, 0);
    await panel.getByRole("tab", { name: "Accept", exact: true }).click();
    await panel
      .getByRole("button", { name: "Adjust routing and reason" })
      .click();
    await panel
      .getByLabel("Assignee", { exact: true })
      .selectOption(opts.operator.id);
    await panel
      .getByLabel("Start status", { exact: true })
      .selectOption(status("started").id);
    await panel.getByLabel(/^Reason/).fill("A native owned next step");
    await panel.getByRole("button", { name: "Accept and route work" }).click();
    await confirmation.filter({ hasText: "Accepted" }).waitFor();
    await observer.checkpoint("Accepted version", 1, 1);
    await confirmation
      .getByRole("link", { name: "Current · Now →", exact: true })
      .waitFor();
    await confirmation
      .getByRole("link", { name: "My work →", exact: true })
      .waitFor();

    await page.reload();
    await confirmation.filter({ hasText: "Accepted" }).waitFor();
    await observer.checkpoint("Accepted mount", 1, 1);
    await confirmation
      .getByRole("link", { name: "My work →", exact: true })
      .waitFor();
    await changeProperty(
      issue.identifier,
      "Issue status",
      status("completed").id,
    );
    await observer.checkpoint("Completed version", 1, 1);
    assert.equal(
      await confirmation
        .getByRole("link", { name: "My work →", exact: true })
        .count(),
      0,
    );
    await confirmation
      .getByRole("link", { name: "Current · Recently done →", exact: true })
      .waitFor();
    await page.reload();
    await confirmation.filter({ hasText: "Accepted" }).waitFor();
    await observer.checkpoint("Completed mount", 1, 1);
    assert.equal(
      await confirmation
        .getByRole("link", { name: "My work →", exact: true })
        .count(),
      0,
    );
    await confirmation
      .getByRole("link", { name: "Current · Recently done →", exact: true })
      .waitFor();

    await changeProperty(issue.identifier, "Issue assignee", "");
    await observer.checkpoint("Unassigned accepted version", 1, 0);
    await confirmation
      .getByRole("link", { name: "Current · Recently done →", exact: true })
      .waitFor();
    assert.equal(
      await confirmation
        .getByRole("link", { name: "My work →", exact: true })
        .count(),
      0,
    );

    const declined = await create("Confirmation lifecycle: declined");
    await page.goto(`${base}/app/issues/${declined.identifier}`);
    await page
      .getByRole("heading", { name: declined.title, exact: true })
      .waitFor();
    await observer.checkpoint("Second undecided mount", 0, 0);
    await panel.getByRole("tab", { name: "Decline", exact: true }).click();
    await panel
      .getByLabel(/^Reason/)
      .fill("The recorded evidence does not require work");
    await panel.getByRole("button", { name: "Decline issue" }).click();
    await confirmation.filter({ hasText: "Declined" }).waitFor();
    await observer.checkpoint("Declined version", 0, 0);
    await page.reload();
    await confirmation.filter({ hasText: "Declined" }).waitFor();
    await observer.checkpoint("Declined mount", 0, 0);
  } finally {
    observer.stop();
  }
}
