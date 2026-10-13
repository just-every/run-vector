import { auditProofState } from "./ui-proof-state.mjs";
import assert from "node:assert/strict";
import { assertTextContrast } from "./ui-detail-checks.mjs";

// Called unconditionally by ordinary ui-runtime, independent of capture flags.
export async function auditRequiredContrast({
  page,
  base,
  results,
  runCase = async (_name, run) => run(),
  only,
}) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    if (!only || only === "selected-row")
      await runCase(`${width}-contrast-selected-row`, async () => {
        await page.goto(base + "/app/current/FLW-842");
        await page
          .locator(".stream-row.is-selected .stream-row-meta")
          .waitFor({ state: "attached" });
        const selected = page.locator(".stream-row.is-selected");
        assert.equal(
          await selected.count(),
          1,
          "exactly one real selected stream row",
        );
        assert.equal(await selected.getAttribute("id"), "issue-row-FLW-842");
        const selectedBackground = await selected.evaluate(
          (node) => getComputedStyle(node).backgroundColor,
        );
        assert.ok(
          !["transparent", "rgba(0, 0, 0, 0)"].includes(selectedBackground),
          "selected row has its computed selection background",
        );
        if (width === 390)
          assert.equal(
            await selected.isVisible(),
            false,
            "phone detail intentionally hides its underlying selected stream",
          );
        // The selected row stays mounted under the phone detail; computed colours
        // still guard that responsive state, with a required real DOM match.
        results.push({
          width,
          contrast: "selected-row",
          selectedBackground,
          intentionallyHidden: width === 390,
          measurements: await assertTextContrast(
            page,
            ".stream-row.is-selected .stream-row-meta",
            `${width} selected row details`,
            { allowHidden: width === 390 },
          ),
        });
      });
    if (!only || only === "empty-section")
      await runCase(`${width}-contrast-empty-section`, async () => {
        await page.goto(base + "/app/current");
        await page
          .locator(".stream-filters")
          .getByLabel("Priority", { exact: true })
          .selectOption("high");
        await page.locator(".stream-empty").first().waitFor();
        results.push({
          width,
          contrast: "empty-section",
          measurements: await assertTextContrast(
            page,
            ".stream-empty",
            `${width} Nothing in this section`,
          ),
        });
        // Current filters persist per operator (VIEW-003); restore the defaults.
        const reset = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/preferences/current" &&
            response.request().method() === "DELETE",
        );
        await page
          .locator(".stream-filters")
          .getByRole("button", { name: "Reset filters", exact: true })
          .click();
        assert.equal((await reset).status(), 200);
      });
    if (!only || only === "decision-labels")
      await runCase(`${width}-contrast-decision-labels`, async () => {
        await page.goto(base + "/app/issues/FLW-842");
        const panel = page.locator(".decision-panel");
        await panel.waitFor();
        if (width === 390)
          await panel
            .getByRole("button", { name: "Adjust routing and reason" })
            .click();
        results.push({
          width,
          contrast: "decision-labels",
          measurements: await assertTextContrast(
            page,
            ".decision-form label > span",
            `${width} decision labels`,
          ),
        });
      });
    await runCase(`${width}-contrast-state-audit`, () =>
      auditProofState(page, `${width}-contrast-states-verified`),
    );
  }
}
