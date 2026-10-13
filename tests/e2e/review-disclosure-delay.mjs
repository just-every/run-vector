import assert from "node:assert/strict";
import { openAdministrationForm } from "./ui-administration-form.mjs";
import { fetchHeld } from "./route-fetch.mjs";

// Retain the reviewed algorithm as an executable regression control only.
async function previousOpenDisclosures(page) {
  for (let pass = 0; pass < 3; pass++) {
    await page.locator("details").evaluateAll((elements) =>
      elements.forEach((element) => {
        if (element.getClientRects().length) element.open = true;
      }),
    );
    await page.waitForTimeout(80);
  }
}
export async function proveDelayedAdministration({ page, base, runCase }) {
  for (const width of [1440, 390])
    await runCase(`${width}-delayed-real-create`, async () => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const measurements = [];
      for (const strategy of ["previous", "corrected"]) {
        await page.goto(base + "/app/settings");
        const name = `Delayed ${strategy} ${width}`;
        let release, fetched;
        const blocked = new Promise((resolve) => {
          release = resolve;
        });
        const actualCreated = new Promise((resolve) => {
          fetched = resolve;
        });
        let receivedAt;
        await page.route("**/api/settings/labels", async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          const response = await fetchHeld(route);
          assert.equal(
            response.status(),
            200,
            "real server committed label before response delay",
          );
          receivedAt = Date.now();
          fetched();
          await blocked;
          await route.fulfill({ response }); // Forward untouched actual response.
        });
        try {
          const create = page.getByRole("form", {
            name: "Create label",
            exact: true,
          });
          await create.getByLabel("Label name", { exact: true }).fill(name);
          await create
            .getByLabel("Label colour", { exact: true })
            .fill("#224466");
          await create
            .getByRole("button", { name: "Create label", exact: true })
            .click();
          await actualCreated;
          let opening;
          if (strategy === "previous") await previousOpenDisclosures(page);
          else opening = openAdministrationForm(page, "Edit label " + name);
          await page.waitForTimeout(600);
          const delayedMilliseconds = Date.now() - receivedAt;
          assert.ok(delayedMilliseconds > 240);
          release();
          const form = page.getByRole("form", {
            name: "Edit label " + name,
            exact: true,
            includeHidden: true,
          });
          await form.waitFor({ state: "attached" });
          if (strategy === "previous") {
            assert.equal(
              await form.isVisible(),
              false,
              "reviewed helper fails: later row remains collapsed",
            );
            await openAdministrationForm(page, "Edit label " + name);
          } else {
            await opening;
            assert.equal(
              await form.isVisible(),
              true,
              "corrected helper waits for actual row and opens it",
            );
          }
          measurements.push({
            strategy,
            delayedMilliseconds,
            expectedVisible: strategy === "corrected",
          });
        } finally {
          release();
          await page.unroute("**/api/settings/labels");
        }
      }
      console.info(JSON.stringify({ disclosureDelay: width, measurements }));
    });
}
