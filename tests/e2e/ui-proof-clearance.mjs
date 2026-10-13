import assert from "node:assert/strict";
import {
  assertNavigationClearance,
  openDisclosures,
} from "./ui-controls-checks.mjs";

// Scroll listeners and ResizeObserver update the sheet's reserved space on frames.
async function settleAtBottom(page) {
  await page.evaluate(async () => {
    let previous,
      stable = 0;
    for (let frame = 0; frame < 120; frame++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(requestAnimationFrame);
      const geometry = JSON.stringify([
        scrollY,
        document.documentElement.scrollHeight,
        document.querySelector(".decision-panel")?.getBoundingClientRect().top,
      ]);
      stable = geometry === previous ? stable + 1 : 0;
      previous = geometry;
      if (stable >= 3) return;
    }
    throw Error("scroll and decision geometry did not settle");
  });
}

export async function auditProofClearance(page, label) {
  const state = () =>
    page.evaluate(() => ({
      scrollY,
      disclosures: [...document.querySelectorAll("details")].map(
        (node) => node.open,
      ),
      routing: document
        .querySelector(".decision-panel")
        ?.classList.contains("is-routing-expanded"),
      compact: document
        .querySelector(".decision-panel")
        ?.classList.contains("is-compact"),
    }));
  const original = await state();
  await settleAtBottom(page);
  const paintedState = await state();
  const painted = await page.evaluate(() => {
    const nav = document.querySelector(".app-mobile-nav");
    if (!nav || getComputedStyle(nav).display === "none") return null;
    const fixed = (element) => {
      for (let node = element; node; node = node.parentElement)
        if (getComputedStyle(node).position === "fixed") return true;
      return false;
    };
    const content = [
      ...document.querySelectorAll(
        "main p,main li,main button,main a,main input,main select,main textarea,main summary,main [role=textbox],main [contenteditable=true]",
      ),
    ].filter(
      (node) =>
        node.getClientRects().length &&
        node.checkVisibility({ visibilityProperty: true }) &&
        !fixed(node),
    );
    const sheet = document.querySelector(".decision-panel");
    return {
      visibleCount: content.length,
      bottom: Math.max(
        ...content.map((node) => node.getBoundingClientRect().bottom),
      ),
      navTop: nav.getBoundingClientRect().top,
      sheetTop:
        sheet?.checkVisibility({ visibilityProperty: true }) &&
        getComputedStyle(sheet).position === "fixed"
          ? sheet.getBoundingClientRect().top
          : null,
    };
  });
  if (painted) {
    assert.ok(
      painted.visibleCount > 0,
      `${label}: painted content is non-vacuous`,
    );
    assert.ok(
      painted.bottom <= painted.navTop + 1,
      `${label}: painted content clears navigation ${JSON.stringify(painted)}`,
    );
    if (painted.sheetTop !== null)
      assert.ok(
        painted.bottom <= painted.sheetTop + 1,
        `${label}: painted content clears decision sheet ${JSON.stringify(painted)}`,
      );
  }
  // Chromium retains boxes for unpainted descendants of closed native details.
  // Preserve the historical helper's expanded-disclosure domain and assertions.
  await openDisclosures(page);
  await settleAtBottom(page);
  const historicalState = await state();
  const historicalExpanded = await assertNavigationClearance(
    page,
    `${label}: historical expanded disclosures`,
  );
  await page.locator("details").evaluateAll((nodes, states) => {
    if (nodes.length !== states.length)
      throw Error("disclosures changed during clearance audit");
    nodes.forEach((node, index) => {
      node.open = states[index];
    });
  }, original.disclosures);
  await page.evaluate((y) => window.scrollTo(0, y), original.scrollY);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const panel = page.locator(".decision-panel");
  if (
    original.routing &&
    !(await panel.evaluate((node) =>
      node.classList.contains("is-routing-expanded"),
    ))
  )
    await panel
      .getByRole("button", { name: "Adjust routing and reason", exact: true })
      .click();
  else if (
    original.compact === false &&
    (await panel.evaluate((node) => node.classList.contains("is-compact")))
  )
    await panel
      .getByRole("button", { name: "Show all decisions", exact: true })
      .click();
  assert.deepEqual(
    await page
      .locator("details")
      .evaluateAll((nodes) => nodes.map((node) => node.open)),
    original.disclosures,
    `${label}: original disclosures restored`,
  );
  return {
    painted,
    paintedState,
    historicalExpanded,
    historicalState,
    restoredState: await state(),
    restoredDisclosures: original.disclosures,
  };
}
