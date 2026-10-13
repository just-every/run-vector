import assert from "node:assert/strict";

export async function assertPrimaryContent(page, label) {
  for (const selector of [".issue-description", ".issue-outcome"]) {
    const section = page.locator(selector);
    if (!(await section.count())) continue;
    assert.notEqual(
      await section.getAttribute("open"),
      null,
      `${label}: primary content starts expanded`,
    );
    for (const content of await section.locator(".safe-markdown,p").all()) {
      assert.equal(
        await content.isVisible(),
        true,
        `${label}: full primary content visible`,
      );
      const clipped = await content.evaluate((element) => {
        const faults = [];
        for (
          let node = element;
          node && node !== element.closest(".issue-body");
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (style.webkitLineClamp !== "none" && style.webkitLineClamp !== "0")
            faults.push("line clamp");
          if (
            ["hidden", "clip"].includes(style.overflowY) &&
            node.scrollHeight > node.clientHeight + 1
          )
            faults.push("vertical clipping");
        }
        return faults;
      });
      assert.deepEqual(
        clipped,
        [],
        `${label}: authored primary text is not clipped or clamped`,
      );
    }
  }
}

export async function assertPropertyTextFit(page) {
  const widths = await page
    .locator(".issue-property-bar select")
    .evaluateAll((selects) => {
      const canvas = document.createElement("canvas"),
        context = canvas.getContext("2d");
      return selects.map((select) => {
        const style = getComputedStyle(select);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const text = select.selectedOptions[0].textContent.trim();
        return {
          text,
          needed: context.measureText(text).width,
          available:
            select.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight) -
            20,
        };
      });
    });
  for (const width of widths)
    assert.ok(
      width.needed <= width.available,
      `selected property text fits: ${JSON.stringify(width)}`,
    );
}

export async function assertMobileNavigationTargets(page) {
  const navigation = await page.locator(".app-mobile-nav").evaluate((nav) => {
    const height = nav.getBoundingClientRect().height;
    const reserved = parseFloat(
      getComputedStyle(document.querySelector(".app-shell")).paddingBottom,
    );
    const targets = [...nav.querySelectorAll("a,button")].map((control) => {
      const rect = control.getBoundingClientRect();
      const label = control.cloneNode(true);
      label
        .querySelectorAll('[aria-hidden="true"]')
        .forEach((icon) => icon.remove());
      return {
        label: control.getAttribute("aria-label") ?? label.textContent.trim(),
        href: control.getAttribute("href"),
        tag: control.tagName,
        height: rect.height,
        hit: control.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        ),
      };
    });
    return { height, reserved, targets };
  });
  assert.ok(
    navigation.reserved >= navigation.height,
    "mobile shell reserves the full navigation height",
  );
  for (const [label, href] of [
    ["Current", "/app"],
    ["My work", "/app/my-work"],
    ["Projects", "/app/projects"],
    ["Issues", "/app/issues"],
    ["New issue", "/app/new-issue"],
  ]) {
    assert.ok(
      navigation.targets.some(
        (target) => target.label === label && target.href === href,
      ),
      `${label}: current mobile navigation destination remains available`,
    );
  }
  assert.ok(
    navigation.targets.some(
      (target) => target.label === "Search" && target.tag === "BUTTON",
    ),
    "Search: current mobile navigation action remains available",
  );
  for (const target of navigation.targets) {
    assert.ok(
      target.height >= 44,
      `${target.label}: mobile target is at least 44px`,
    );
    assert.ok(
      target.hit,
      `${target.label}: mobile target remains hit-testable`,
    );
  }
  return navigation;
}

export async function assertPinnedDecision(page) {
  const action = page.locator(".decision-actions button");
  const measure = async () =>
    action.evaluate((button) => {
      const rect = button.getBoundingClientRect(),
        nav = document.querySelector(".app-mobile-nav").getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        navTop: nav.top,
        hit: button.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        ),
      };
    });
  const fieldsBefore = await page
    .locator(".decision-fields")
    .evaluate((fields) => ({
      scrollTop: fields.scrollTop,
      scrollHeight: fields.scrollHeight,
      clientHeight: fields.clientHeight,
    }));
  assert.ok(
    fieldsBefore.scrollHeight > fieldsBefore.clientHeight,
    "expanded routing fields overflow their scroll area",
  );
  const before = await measure();
  assert.ok(
    before.top >= 0 && before.bottom <= before.navTop && before.hit,
    `expanded decision action reachable ${JSON.stringify(before)}`,
  );
  await page.locator(".decision-fields").evaluate((fields) => {
    fields.scrollTop = fields.scrollHeight;
  });
  assert.ok(
    await page
      .locator(".decision-fields")
      .evaluate((fields) => fields.scrollTop > 0),
    "expanded fields actually scroll",
  );
  const fieldsAfter = await page
    .locator(".decision-fields")
    .evaluate((fields) => fields.scrollTop);
  assert.notEqual(
    fieldsAfter,
    fieldsBefore.scrollTop,
    "scrolling changes the routing fields position",
  );
  const after = await measure();
  assert.ok(
    after.top >= 0 && after.bottom <= after.navTop && after.hit,
    `scrolled decision action reachable ${JSON.stringify(after)}`,
  );
  assert.equal(
    after.top,
    before.top,
    "decision action remains pinned while fields scroll",
  );
  return {
    before,
    after,
    fieldsBefore,
    fieldsScrollTop: await page
      .locator(".decision-fields")
      .evaluate((fields) => fields.scrollTop),
  };
}

export async function assertControlGap(first, second, label) {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  assert.ok(a && b, `${label}: both controls are visible`);
  const gap = Math.max(
    b.x - a.x - a.width,
    a.x - b.x - b.width,
    b.y - a.y - a.height,
    a.y - b.y - b.height,
  );
  assert.ok(
    gap >= 8,
    `${label}: controls have at least 8px of separation (${gap})`,
  );
}

// Browser-computed colours include inherited values and color-mix(). Canvas
// normalises every CSS colour, then ancestor backgrounds/opacity are composited.
export async function assertTextContrast(
  page,
  selector,
  label,
  { allowHidden = false } = {},
) {
  const targets = page.locator(selector);
  if (!allowHidden) {
    assert.ok(
      await targets.count(),
      `${label}: visible contrast targets exist`,
    );
    for (const target of await targets.all())
      assert.equal(
        await target.isVisible(),
        true,
        `${label}: contrast target is visible`,
      );
  }
  const measurements = await page.locator(selector).evaluateAll((nodes) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const color = (css) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const rgba = [...context.getImageData(0, 0, 1, 1).data];
      return [rgba[0], rgba[1], rgba[2], rgba[3] / 255];
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return alpha
        ? [0, 1, 2]
            .map(
              (index) =>
                (front[index] * front[3] +
                  back[index] * back[3] * (1 - front[3])) /
                alpha,
            )
            .concat(alpha)
        : [0, 0, 0, 0];
    };
    const luminance = (rgba) =>
      rgba
        .slice(0, 3)
        .map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    return nodes.map((node) => {
      const style = getComputedStyle(node);
      let foreground = color(style.color),
        background = [0, 0, 0, 0];
      const layers = [];
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        const layer = getComputedStyle(ancestor);
        if (layer.backgroundImage !== "none")
          throw Error("Contrast requires a solid effective background");
        const paint = color(layer.backgroundColor);
        foreground = over(foreground, paint);
        background = over(background, paint);
        foreground[3] *= Number(layer.opacity);
        background[3] *= Number(layer.opacity);
        layers.push({ color: layer.backgroundColor, opacity: layer.opacity });
      }
      foreground = over(foreground, [255, 255, 255, 1]);
      background = over(background, [255, 255, 255, 1]);
      const a = luminance(foreground),
        b = luminance(background);
      return {
        text: node.textContent.trim(),
        foreground,
        background,
        layers,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  });
  assert.ok(
    measurements.length > 0,
    `${label}: contrast target is non-vacuous (${selector})`,
  );
  for (const result of measurements)
    assert.ok(
      result.ratio >= 4.5,
      `${label}: contrast ${result.ratio.toFixed(3)} < 4.5:1 ${JSON.stringify(result)}`,
    );
  return measurements;
}
