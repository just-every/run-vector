import assert from "node:assert/strict";
import { auditProofState } from "./ui-proof-state.mjs";

export async function auditReviewCycle({
  page,
  base,
  req,
  opts,
  headers,
  runCase = async (_name, run) => run(),
}) {
  assert.ok(opts.cycles.length, "real cycle fixture exists");
  const cycle = opts.cycles[0];
  for (const width of [1440, 390])
    await runCase(`${width}-cycle-picker-and-copy`, async () => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const created = await req("/api/issues", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `Pick this cycle issue ${width}`,
          teamId: cycle.teamId,
        }),
      });
      assert.equal(created.status, 201);
      const issue = await created.json();
      await page.goto(`${base}/app/cycles/${cycle.id}`);
      const form = page.getByRole("form", {
        name: "Commit issue to cycle",
        exact: true,
      });
      const input = form.getByLabel("Issue identifier", { exact: true });
      await input.waitFor();
      const response = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === "/api/issues" &&
          url.searchParams.get("q") === issue.title
        );
      });
      await input.fill(issue.title);
      const choices = await response;
      assert.equal(choices.status(), 200);
      assert.equal(new URL(choices.url()).searchParams.get("category"), "all");
      const list = form.getByRole("listbox", {
        name: "Eligible cycle issues",
        exact: true,
      });
      const suggestion = list
        .getByRole("option")
        .filter({ hasText: issue.identifier });
      await suggestion.waitFor();
      assert.match(await suggestion.textContent(), new RegExp(issue.title));
      assert.equal(
        await input.getAttribute("aria-controls"),
        await list.getAttribute("id"),
        "input identifies its actual choice list",
      );
      const optionCount = await list.getByRole("option").count();
      assert.ok(
        optionCount > 0 && optionCount <= 50,
        "choices are bounded actual search results",
      );
      await auditProofState(page, `${width}-cycle-search-results`);
      assert.equal(
        optionCount,
        1,
        "the unique real issue title yields its actual choice",
      );
      await input.press("ArrowDown");
      assert.equal(await suggestion.getAttribute("aria-selected"), "true");
      assert.equal(
        await input.getAttribute("aria-activedescendant"),
        await suggestion.getAttribute("id"),
      );
      await input.press("Enter");
      assert.equal(
        await input.inputValue(),
        issue.identifier,
        "choosing the rendered suggestion inserts its identifier",
      );
      // The existing administration journey separately retains typed identifiers.
      const receipt = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/issues/${issue.identifier}` &&
          response.request().method() === "PATCH",
      );
      await form
        .getByRole("button", { name: "Commit issue", exact: true })
        .click();
      const saved = await receipt;
      assert.equal(saved.status(), 200);
      assert.deepEqual(saved.request().postDataJSON(), {
        expectedVersion: issue.version,
        cycleId: cycle.id,
      });
      assert.equal(
        (
          await (
            await req(`/api/issues/${issue.identifier}`, { headers })
          ).json()
        ).cycle?.id,
        cycle.id,
      );
      const committedIssue = page.getByRole("group", {
        name: `Cycle issue ${issue.identifier}`,
        exact: true,
      });
      await committedIssue.waitFor({ state: "visible" });
      const committedLink = committedIssue.getByRole("link", {
        name: `${issue.identifier} · ${issue.title}`,
        exact: true,
      });
      await committedLink.waitFor({ state: "visible" });
      const commitment = committedIssue.getByRole("combobox");
      await commitment.waitFor({ state: "visible" });
      await page.waitForFunction(
        ({ ariaLabel, cycleId }) => {
          const row = [...document.querySelectorAll('[role="group"]')].find(
            (element) => element.getAttribute("aria-label") === ariaLabel,
          );
          return row?.querySelector("select")?.value === cycleId;
        },
        {
          ariaLabel: `Cycle issue ${issue.identifier}`,
          cycleId: cycle.id,
        },
      );
      assert.equal(
        await commitment.inputValue(),
        cycle.id,
        "the rendered committed issue selects its saved cycle",
      );
      const progress = page.getByRole("region", {
        name: "Cycle progress",
        exact: true,
      });
      assert.match(await progress.textContent(), /work left|unfinished issue/);
      assert.doesNotMatch(
        await progress.textContent(),
        /estimated points remain|remaining issues without estimates/,
      );
      await auditProofState(page, `${width}-cycle-commit-saved`);
      await page.goto(base + "/app/settings");
      await page.getByText(/Timezone, for example .*Europe\/London/).waitFor();
      await page
        .getByText(/When clocks change, choose a time that occurs once/)
        .waitFor();
      assert.doesNotMatch(
        await page
          .getByRole("region", { name: "Cycles", exact: true })
          .textContent(),
        /daylight-saving times are rejected/,
      );
    });
}
