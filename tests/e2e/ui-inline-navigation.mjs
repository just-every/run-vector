import assert from "node:assert/strict";
import { auditProofState } from "./ui-proof-state.mjs";

export async function exerciseInlineNavigation({
  page,
  base,
  req,
  opts,
  headers,
  runCase = async (_name, run) => run(),
}) {
  const team = opts.teams[0];
  const status = opts.statuses.find(
    (status) => status.teamId === team.id && status.category === "started",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const records = [];
    for (const name of [
      "Conflicted inline source",
      "Fresh inline destination",
    ]) {
      const response = await req("/api/issues", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `${name} ${width}`,
          teamId: team.id,
          statusId: status.id,
          assigneeOperatorId: opts.operator.id,
        }),
      });
      assert.equal(response.status, 201);
      records.push(await response.json());
    }
    const [source, destination] = records;
    for (const [name, field, draft, value] of [
      ["estimate", "estimate", "8", 8],
      ["due date", "dueDate", "2027-04-12", "2027-04-12"],
      [
        "expected outcome",
        "expectedOutcome",
        "Fresh destination outcome",
        "Fresh destination outcome",
      ],
      [
        "customer impact",
        "customerImpact",
        "Fresh destination impact",
        "Fresh destination impact",
      ],
      ["labels", "labelIds", opts.labels[0].name, [opts.labels[0].id]],
    ])
      await runCase(`${width}-inline-navigation-${field}`, async () => {
        const read = async (issue) =>
          (await req(`/api/issues/${issue.identifier}`, { headers })).json();
        const open = async () => {
          if (field === "labelIds") {
            await page
              .locator(".issue-label-summary")
              .getByRole("button", { name: /^Labels/ })
              .click();
            return page.getByRole("form", {
              name: "Apply issue labels",
              exact: true,
            });
          }
          await page
            .getByRole("button", { name: `Edit ${name}`, exact: true })
            .click();
          return page.getByRole("form", { name: `Edit ${name}`, exact: true });
        };
        const fill = (form) =>
          field === "labelIds"
            ? form.getByLabel(draft, { exact: true }).check()
            : form.getByLabel(`Issue ${name}`, { exact: true }).fill(draft);
        const save = async (form, issue, expectedVersion, expectedStatus) => {
          const receipt = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                `/api/issues/${issue.identifier}` &&
              response.request().method() === "PATCH",
          );
          await form
            .getByRole("button", { name: `Save ${name}`, exact: true })
            .click();
          const response = await receipt;
          assert.equal(response.status(), expectedStatus);
          assert.deepEqual(response.request().postDataJSON(), {
            expectedVersion,
            [field]: value,
          });
        };
        await page.goto(`${base}/app/current/${source.identifier}`);
        let form = await open();
        await fill(form);
        const before = await read(source);
        const competing = await req(`/api/issues/${source.identifier}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            expectedVersion: before.version,
            title: `${source.title} competing ${field}`,
          }),
        });
        assert.equal(competing.status, 200);
        await save(form, source, before.version, 409);
        await form.getByRole("alert").waitFor();
        const marker = `${width}-${field}`;
        await page.evaluate((value) => {
          window.__inlineNavigationDocument = value;
        }, marker);
        if (width === 390)
          await page
            .getByRole("button", { name: "← Back to list", exact: true })
            .click();
        await page.locator(`#issue-row-${destination.identifier}`).click();
        await page
          .getByRole("heading", { name: destination.title, exact: true })
          .waitFor();
        assert.equal(
          await page.evaluate(() => window.__inlineNavigationDocument),
          marker,
          "source-to-destination uses the same client document",
        );
        form = await open();
        assert.equal(
          await form.getByRole("alert").count(),
          0,
          "source conflict does not carry to another issue",
        );
        if (field === "labelIds")
          assert.equal(
            await form.getByLabel(draft, { exact: true }).isChecked(),
            false,
            "source label draft does not carry",
          );
        else
          assert.equal(
            await form
              .getByLabel(`Issue ${name}`, { exact: true })
              .inputValue(),
            "",
            "source draft does not carry",
          );
        const destinationBefore = await read(destination);
        await fill(form);
        await save(form, destination, destinationBefore.version, 200);
        await form.waitFor({ state: "hidden" });
        const persisted = await read(destination);
        assert.deepEqual(
          field === "labelIds"
            ? persisted.labels.map((label) => label.id)
            : persisted[field],
          value,
        );
        await auditProofState(page, `${width}-inline-navigation-${field}`, {
          clauses: ["ISSUE-007", "ISSUE-011"],
        });
      });
  }
}
