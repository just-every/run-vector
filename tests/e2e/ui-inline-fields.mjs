import assert from "node:assert/strict";
import { auditProofState } from "./ui-proof-state.mjs";

const fields = [
  ["estimate", "estimate", "13", 13, "21"],
  ["due date", "dueDate", "2027-02-18", "2027-02-18", "2027-03-19"],
  [
    "expected outcome",
    "expectedOutcome",
    "A lasting outcome",
    "A lasting outcome",
    "Retain this outcome draft",
  ],
  [
    "customer impact",
    "customerImpact",
    "Customers finish their work",
    "Customers finish their work",
    "Retain this impact draft",
  ],
];

export async function exerciseInlineFields(context) {
  const {
    page,
    base,
    req,
    opts,
    headers,
    runCase = async (_name, run) => run(),
  } = context;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, key, input, value, draft] of fields) {
      await runCase(`${width}-inline-${key}`, async () => {
        const create = await req("/api/issues", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: `Inline ${name} ${width}`,
            teamId: opts.teams[0].id,
          }),
        });
        assert.equal(create.status, 201);
        const issue = await create.json();
        const endpoint = `/api/issues/${issue.identifier}`;
        const read = async () => {
          const response = await req(endpoint, { headers });
          assert.equal(response.status, 200);
          return response.json();
        };
        const open = async () => {
          await page
            .getByRole("button", { name: `Edit ${name}`, exact: true })
            .click();
          const form = page.getByRole("form", {
            name: `Edit ${name}`,
            exact: true,
          });
          await form.waitFor();
          return form;
        };
        const save = async (
          form,
          expectedVersion,
          expectedValue,
          status = 200,
        ) => {
          const receipt = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === endpoint &&
              response.request().method() === "PATCH",
          );
          await form
            .getByRole("button", { name: `Save ${name}`, exact: true })
            .click();
          const response = await receipt;
          assert.deepEqual(
            response.request().postDataJSON(),
            { expectedVersion, [key]: expectedValue },
            "one field plus the last-read version",
          );
          assert.equal(response.status(), status);
          return response.json();
        };
        await page.goto(base + "/app/issues/" + issue.identifier);
        let form = await open();
        await form.getByLabel(`Issue ${name}`, { exact: true }).fill(input);
        await auditProofState(page, `${width}-inline-${key}-editing`, {
          clauses: ["ISSUE-007", "ISSUE-011"],
        });
        const before = await read();
        await save(form, before.version, value);
        await form.waitFor({ state: "hidden" });
        assert.equal((await read())[key], value);
        await page.reload();
        form = await open();
        assert.equal(
          await form.getByLabel(`Issue ${name}`, { exact: true }).inputValue(),
          input,
          "saved field persists after reload",
        );
        await form.getByLabel(`Issue ${name}`, { exact: true }).fill("");
        await save(form, (await read()).version, null);
        await form.waitFor({ state: "hidden" });
        assert.equal(
          (await read())[key],
          null,
          "empty field explicitly clears to null",
        );
        await page.reload();
        form = await open();
        assert.equal(
          await form.getByLabel(`Issue ${name}`, { exact: true }).inputValue(),
          "",
          "clear persists after reload",
        );
        await form.getByLabel(`Issue ${name}`, { exact: true }).fill(draft);
        const stale = await read();
        const competing = await req(endpoint, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            expectedVersion: stale.version,
            priority: "high",
          }),
        });
        assert.equal(competing.status, 200);
        const latest = await competing.json();
        await save(
          form,
          stale.version,
          key === "estimate" ? Number(draft) : draft,
          409,
        );
        await form.getByRole("alert").waitFor();
        assert.equal(
          await form.getByLabel(`Issue ${name}`, { exact: true }).inputValue(),
          draft,
          "conflict retains unsent field draft",
        );
        assert.deepEqual(await read(), latest, "stale field writes nothing");
        await auditProofState(page, `${width}-inline-${key}-conflict`, {
          clauses: ["ISSUE-007", "ISSUE-011"],
        });
      });
    }
    await runCase(`${width}-inline-labels`, () =>
      exerciseLabels({ ...context, width }),
    );
  }
}

async function exerciseLabels({ page, base, req, opts, headers, width }) {
  assert.ok(opts.labels.length, "label test has actual choices");
  const label = opts.labels[0];
  const create = await req("/api/issues", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: `Inline labels ${width}`,
      teamId: opts.teams[0].id,
    }),
  });
  assert.equal(create.status, 201);
  const issue = await create.json(),
    endpoint = `/api/issues/${issue.identifier}`;
  const read = async () => (await req(endpoint, { headers })).json();
  const open = async () => {
    await page
      .locator(".issue-label-summary")
      .getByRole("button", { name: /^Labels/ })
      .click();
    return page.getByRole("form", { name: "Apply issue labels", exact: true });
  };
  const save = async (form, expectedVersion, labelIds, status = 200) => {
    const receipt = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === endpoint &&
        response.request().method() === "PATCH",
    );
    await form
      .getByRole("button", { name: "Save labels", exact: true })
      .click();
    const response = await receipt;
    assert.equal(response.status(), status);
    assert.deepEqual(response.request().postDataJSON(), {
      expectedVersion,
      labelIds,
    });
  };
  await page.goto(base + "/app/issues/" + issue.identifier);
  let form = await open();
  await form.getByLabel(label.name, { exact: true }).check();
  await auditProofState(page, `${width}-inline-labels-editing`, {
    clauses: ["ISSUE-007", "ISSUE-011"],
  });
  await save(form, (await read()).version, [label.id]);
  await form.waitFor({ state: "hidden" });
  assert.deepEqual(
    (await read()).labels.map((label) => label.id),
    [label.id],
  );
  await page.reload();
  form = await open();
  assert.equal(
    await form.getByLabel(label.name, { exact: true }).isChecked(),
    true,
  );
  await form.getByLabel(label.name, { exact: true }).uncheck();
  await save(form, (await read()).version, []);
  await form.waitFor({ state: "hidden" });
  await page.reload();
  form = await open();
  assert.equal(
    await form.getByLabel(label.name, { exact: true }).isChecked(),
    false,
  );
  const stale = await read();
  await form.getByLabel(label.name, { exact: true }).check();
  const competing = await req(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ expectedVersion: stale.version, priority: "high" }),
  });
  assert.equal(competing.status, 200);
  const latest = await competing.json();
  await save(form, stale.version, [label.id], 409);
  await form.getByRole("alert").waitFor();
  assert.equal(
    await form.getByLabel(label.name, { exact: true }).isChecked(),
    true,
  );
  assert.deepEqual(await read(), latest);
  await auditProofState(page, `${width}-inline-labels-conflict`, {
    clauses: ["ISSUE-007", "ISSUE-011"],
  });
}
