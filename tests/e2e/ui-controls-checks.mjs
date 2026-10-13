import assert from "node:assert/strict";

export async function assertControls(page, label) {
  const audit = await page
    .locator(
      "button,a,input,select,textarea,[role=button],[role=textbox],[contenteditable=true]",
    )
    .evaluateAll((elements) => {
      const frame = document.createElement("iframe");
      frame.style.cssText =
        "position:absolute;width:1px;height:1px;visibility:hidden";
      document.body.append(frame);
      const properties = [
        "fontFamily",
        "color",
        "backgroundColor",
        "backgroundImage",
        "borderTopColor",
        "borderTopWidth",
        "borderTopStyle",
        "borderRadius",
        "paddingTop",
        "paddingRight",
        "textDecorationLine",
      ];
      const records = elements
        .filter(
          (element) =>
            element.getClientRects().length &&
            getComputedStyle(element).visibility !== "hidden",
        )
        .map((element) => {
          const style = getComputedStyle(element),
            clean = frame.contentDocument.createElement(element.tagName);
          if (element.hasAttribute("type"))
            clean.setAttribute("type", element.getAttribute("type"));
          frame.contentDocument.body.append(clean);
          const native = frame.contentWindow.getComputedStyle(clean);
          const authored = Object.fromEntries(
            properties.map((p) => [p, style[p]]),
          );
          const defaults = Object.fromEntries(
            properties.map((p) => [p, native[p]]),
          );
          clean.remove();
          return {
            selector:
              element.tagName.toLowerCase() +
              (element.getAttribute("type")
                ? `[type="${element.getAttribute("type")}"]`
                : ""),
            label:
              element.getAttribute("aria-label") ??
              element.labels?.[0]?.textContent?.trim() ??
              element.textContent?.trim().slice(0, 80),
            tag: element.tagName,
            role: element.getAttribute("role"),
            type: element.getAttribute("type"),
            editable: element.isContentEditable,
            text: element.textContent?.trim().slice(0, 50),
            authored,
            defaults,
            height: element.getBoundingClientRect().height,
          };
        });
      frame.remove();
      return records;
    });
  assert.ok(audit.length, `${label}: controls found`);
  for (const control of audit) {
    assert.notDeepEqual(
      control.authored,
      control.defaults,
      `${label}: UA default ${control.text}`,
    );
    if (control.tag === "BUTTON" || control.role === "button") {
      const visibleColor = (color) =>
        color !== "transparent" &&
        color !== "rgba(0, 0, 0, 0)" &&
        !/rgba\([^)]*,\s*0\)$/.test(color);
      const affordance =
        visibleColor(control.authored.backgroundColor) ||
        control.authored.backgroundImage !== "none" ||
        (parseFloat(control.authored.borderTopWidth) > 0 &&
          !["none", "hidden"].includes(control.authored.borderTopStyle) &&
          visibleColor(control.authored.borderTopColor));
      assert.ok(affordance, `${label}: control affordance ${control.text}`);
    }
    if (
      (["INPUT", "SELECT", "TEXTAREA"].includes(control.tag) ||
        control.role === "textbox" ||
        control.editable) &&
      !["checkbox", "radio"].includes(control.type)
    ) {
      assert.ok(
        parseFloat(control.authored.borderTopWidth) > 0 ||
          parseFloat(control.authored.paddingRight) > 0 ||
          control.authored.backgroundColor !== control.defaults.backgroundColor,
        `${label}: authored input surface ${control.text}`,
      );
      assert.notEqual(
        control.authored.backgroundColor,
        "rgb(255, 255, 255)",
        `${label}: unstyled input ${control.text}`,
      );
    }
  }
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `${label}: no horizontal overflow`,
  );
  return audit;
}
export async function openDisclosures(page) {
  // Existing visible disclosures may be nested; opening a parent reveals children.
  await page.locator("main").waitFor({ state: "visible" });
  await page.locator("details").evaluateAll((elements) => {
    for (const element of elements)
      if (element.getClientRects().length) element.open = true;
  });
}

export { openAdministrationForm } from "./ui-administration-form.mjs";
export async function assertNavigationClearance(page, label) {
  const layout = await page.evaluate(() => {
    const nav = document.querySelector(".app-mobile-nav");
    if (!nav || getComputedStyle(nav).display === "none") return null;
    window.scrollTo(0, document.documentElement.scrollHeight);
    const fixed = (element) => {
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement)
        if (getComputedStyle(ancestor).position === "fixed") return true;
      return false;
    };
    const content = [
      ...document.querySelectorAll(
        "main p,main li,main button,main a,main input,main select,main textarea,main summary,main [role=textbox],main [contenteditable=true]",
      ),
    ].filter((element) => element.getClientRects().length && !fixed(element));
    const bottom = Math.max(
      ...content.map((element) => element.getBoundingClientRect().bottom),
    );
    const sheet = document.querySelector(".decision-panel");
    return {
      bottom,
      scrollY: window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      offenders: content
        .filter(
          (element) =>
            element.getBoundingClientRect().bottom >
            nav.getBoundingClientRect().top,
        )
        .map((element) => ({
          tag: element.tagName,
          text: (
            element.getAttribute("aria-label") ||
            element.textContent ||
            ""
          ).slice(0, 100),
          bottom: element.getBoundingClientRect().bottom,
          closedDetails: Boolean(element.closest("details:not([open])")),
        })),
      navTop: nav.getBoundingClientRect().top,
      sheetTop:
        sheet &&
        sheet.getClientRects().length &&
        getComputedStyle(sheet).position === "fixed"
          ? sheet.getBoundingClientRect().top
          : null,
    };
  });
  if (layout) {
    assert.ok(
      layout.bottom <= layout.navTop + 1,
      `${label}: last content clears navigation ${JSON.stringify(layout)}`,
    );
    if (layout.sheetTop !== null)
      assert.ok(
        layout.bottom <= layout.sheetTop + 1,
        `${label}: last content clears decision sheet ${JSON.stringify(layout)}`,
      );
  }
  return layout;
}

export async function assertSettingsSections(page, label) {
  const sections = [
    "Workspace time",
    "Operators",
    "Teams",
    "Labels",
    "Projects",
    "Cycles",
    "Data / Move in",
    "Integrations",
  ];
  for (const name of sections) {
    const section = page.getByRole("region", { name, exact: true });
    await section.waitFor();
    assert.equal(
      await section.getByRole("heading", { name, exact: true }).count(),
      1,
      `${label}: named ${name} section`,
    );
  }
  const notifications = page.getByRole("region", {
    name: "Notifications",
    exact: true,
  });
  await notifications.waitFor();
  assert.equal(
    await notifications
      .getByRole("heading", { name: "Notifications", exact: true })
      .count(),
    1,
    `${label}: named Notifications section`,
  );
  const settings = page
    .getByRole("link", { name: "Settings", exact: true })
    .filter({ visible: true })
    .first();
  assert.equal(
    await settings.getAttribute("aria-current"),
    "page",
    `${label}: visible Settings current navigation state`,
  );
  await settings.focus();
  assert.equal(
    await settings.evaluate((element) => element === document.activeElement),
    true,
    `${label}: Settings reachable by keyboard`,
  );
  const controls = await assertControls(page, label);
  await assertNavigationClearance(page, label);
  return controls;
}

// CMD-003 / VIEW-004: list selection is reachable with ordinary keyboard input.
export async function assertIssueListKeyboard(page, identifiers, capture) {
  const first = page.locator(`#issue-row-${identifiers[0]}`);
  const second = page.locator(`#issue-row-${identifiers[1]}`);
  await first.focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await second.evaluate(element => element === document.activeElement), true, "CMD-003 ArrowDown focuses next issue");
  if (capture) await capture("issues-keyboard-focus-next");
  await page.keyboard.press("ArrowUp");
  assert.equal(await first.evaluate(element => element === document.activeElement), true, "CMD-003 ArrowUp returns to issue");
  await page.keyboard.press("x");
  assert.equal(await page.getByLabel(`Select ${identifiers[0]}`, { exact: true }).isChecked(), true, "CMD-003 X selects focused issue");
  if (capture) await capture("issues-keyboard-selection");
  await page.keyboard.press("x");
  assert.equal(await page.getByLabel(`Select ${identifiers[0]}`, { exact: true }).isChecked(), false, "CMD-003 X deselects focused issue");
  await page.keyboard.press("Enter");
  await page.locator(".issue-inspector").waitFor();
  if (capture) await capture("issues-keyboard-detail");
  await page.keyboard.press("Escape");
  await first.waitFor();
  await page.waitForFunction(id => document.activeElement?.id === id, `issue-row-${identifiers[0]}`);
  assert.equal(await first.evaluate(element => element === document.activeElement), true, "CMD-003 Escape restores opening row focus");
}
