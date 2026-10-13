// During a provisional browser navigation Playwright waits for a replacement
// execution context. Native input still addresses the visible outgoing
// document, whose pending-navigation recovery control takes keyboard focus.
export async function pressReloadDuringNavigation(page) {
  await page.keyboard.press("Enter");
}
