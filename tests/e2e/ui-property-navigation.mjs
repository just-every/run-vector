import assert from "node:assert/strict";

// Keep the same client document through A -> B, using genuine persisted issues
// and a real competing mutation. Both streams reuse the issue detail surface.
export async function exercisePropertyNavigation({
  page,
  base,
  req,
  opts,
  headers,
}) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const team = opts.teams[0];
  const started = opts.statuses.find(
    (status) => status.teamId === team.id && status.category === "started",
  );
  const issues = [];
  for (const name of ["Conflicted source", "Fresh destination"]) {
    const created = await req("/api/issues", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `Property navigation: ${name}`,
        teamId: team.id,
        statusId: started.id,
        assigneeOperatorId: opts.operator.id,
      }),
    });
    assert.equal(created.status, 201);
    issues.push(await created.json());
  }
  const [source, destination] = issues;
  for (const [surface, competingPriority, destinationPriority] of [
    ["current", "urgent", "low"],
    ["my-work", "high", "medium"],
  ]) {
    await page.goto(`${base}/app/${surface}/${source.identifier}`);
    await page.waitForLoadState("networkidle");
    const propertyBar = page.locator(".issue-property-bar");
    const sourcePriority = propertyBar.getByLabel("Issue priority", {
      exact: true,
    });
    assert.equal(
      await sourcePriority.isEnabled(),
      true,
      `${surface}: source ready`,
    );
    const beforeResponse = await req(`/api/issues/${source.identifier}`, {
      headers,
    });
    assert.equal(beforeResponse.status, 200);
    const before = await beforeResponse.json();
    const competing = await req(`/api/issues/${source.identifier}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        expectedVersion: before.version,
        priority: competingPriority,
      }),
    });
    assert.equal(competing.status, 200);
    const competingReceipt = await competing.json();
    const conflictResponse = page.waitForResponse(
      (response) =>
        response.url() === `${base}/api/issues/${source.identifier}` &&
        response.request().method() === "PATCH",
    );
    await sourcePriority.selectOption("medium");
    assert.equal((await conflictResponse).status(), 409);
    await propertyBar
      .getByRole("alert")
      .filter({ hasText: "changed elsewhere" })
      .waitFor();
    assert.equal(await propertyBar.locator("select").count(), 5);
    assert.equal(
      await propertyBar
        .locator("select")
        .evaluateAll((selects) => selects.every((select) => select.disabled)),
      true,
      `${surface}: conflicted source pickers disabled`,
    );
    const sourceAfter = await (
      await req(`/api/issues/${source.identifier}`, { headers })
    ).json();
    assert.equal(
      sourceAfter.version,
      competingReceipt.version,
      `${surface}: rejected edit writes nothing`,
    );
    assert.equal(sourceAfter.priority, competingPriority);

    const destinationBefore = await (
      await req(`/api/issues/${destination.identifier}`, { headers })
    ).json();
    const marker = `${surface}-${destination.identifier}`;
    await page.evaluate((value) => {
      window.__vectorNavigationProbe = value;
    }, marker);
    await page.locator(`#issue-row-${destination.identifier}`).click();
    await page.waitForURL(`${base}/app/${surface}/${destination.identifier}`);
    await page
      .getByRole("heading", { name: destination.title, exact: true })
      .waitFor();
    await page.waitForLoadState("networkidle");
    assert.equal(
      await page.evaluate(() => window.__vectorNavigationProbe),
      marker,
      `${surface}: navigation retained the client document`,
    );
    assert.equal(
      await propertyBar.getByRole("alert").count(),
      0,
      `${surface}: source error does not carry to destination`,
    );
    assert.equal(
      await propertyBar
        .getByRole("button", { name: "Reload properties" })
        .count(),
      0,
    );
    assert.equal(await propertyBar.locator("select").count(), 5);
    assert.equal(
      await propertyBar
        .locator("select")
        .evaluateAll((selects) => selects.every((select) => !select.disabled)),
      true,
      `${surface}: destination pickers enabled`,
    );
    assert.equal(
      await propertyBar
        .getByLabel("Issue priority", { exact: true })
        .inputValue(),
      destinationBefore.priority,
      `${surface}: destination values`,
    );
    const savedResponse = page.waitForResponse(
      (response) =>
        response.url() === `${base}/api/issues/${destination.identifier}` &&
        response.request().method() === "PATCH",
    );
    await propertyBar
      .getByLabel("Issue priority", { exact: true })
      .selectOption(destinationPriority);
    const saved = await savedResponse;
    assert.equal(
      saved.status(),
      200,
      `${surface}: destination update accepted`,
    );
    assert.deepEqual(saved.request().postDataJSON(), {
      expectedVersion: destinationBefore.version,
      priority: destinationPriority,
    });
    const receipt = await saved.json();
    assert.equal(receipt.identifier, destination.identifier);
    assert.equal(receipt.priority, destinationPriority);
    assert.equal(receipt.version, destinationBefore.version + 1);
    await page.waitForLoadState("networkidle");
    // Network completion precedes React applying the receipt and clearing busy.
    await page.waitForFunction(
      (priority) => {
        const picker = document.querySelector(
          '.issue-property-bar select[aria-label="Issue priority"]',
        );
        return picker?.value === priority && !picker.disabled;
      },
      destinationPriority,
    );
    assert.equal(
      await propertyBar
        .getByLabel("Issue priority", { exact: true })
        .inputValue(),
      destinationPriority,
    );
    const persisted = await req(`/api/issues/${destination.identifier}`, {
      headers,
    });
    assert.equal(persisted.status, 200);
    const persistedIssue = await persisted.json();
    assert.equal(persistedIssue.priority, destinationPriority);
    assert.equal(persistedIssue.version, receipt.version);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}
