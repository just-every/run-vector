export async function openAdministrationForm(page, formName) {
  const form = page.getByRole("form", {
    name: formName,
    exact: true,
    includeHidden: true,
  });
  const disclosure = page.locator("details").filter({ has: form });
  const summary = disclosure.locator(":scope > summary");
  await summary.waitFor({ state: "visible" });
  if (!(await disclosure.evaluate((element) => element.open)))
    await summary.click();
  await form.waitFor({ state: "visible" });
  return form;
}
