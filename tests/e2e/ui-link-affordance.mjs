import assert from "node:assert/strict";

// Read actual anchors from the emitted app; no injected controls or styles.
export async function assertBareLinkAffordance(link, label) {
  await link.waitFor();
  assert.ok(!(await link.getAttribute("class")), `${label}: bare anchor`);
  const style = await link.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      decoration: computed.textDecorationLine,
      offset: computed.textUnderlineOffset,
      color: computed.color,
    };
  });
  assert.ok(
    style.decoration.includes("underline"),
    `${label}: visible underline`,
  );
  assert.ok(
    parseFloat(style.offset) > 0,
    `${label}: authored underline offset`,
  );
  assert.notEqual(
    style.color,
    "rgb(0, 0, 238)",
    `${label}: authored link color, not the browser default`,
  );
}

export async function assertUndecoratedLink(link, label) {
  await link.waitFor();
  assert.equal(
    await link.evaluate(
      (element) => getComputedStyle(element).textDecorationLine,
    ),
    "none",
    `${label}: intentional action/navigation decoration`,
  );
}
