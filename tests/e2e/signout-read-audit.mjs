import { openAccountMenu } from './ui-controls-checks.mjs';
// Read-only instrumentation: a real DOM click defines the boundary in the
// same JS context as genuine fetch invocation. Native arguments, timing,
// responses and errors pass through unchanged; only paths reach the harness.
export async function auditSignOutReads(page) {
  const starts = [];
  await page.exposeFunction("recordSignOutRead", (attempt, path) => {
    starts.push({ attempt, path });
  });
  await page.addInitScript(() => {
    window.signOutReadAttempt = 0;
    document.addEventListener(
      "click",
      (event) => {
        const target =
          event.target instanceof Element
            ? event.target.closest("button")
            : null;
        if (target?.textContent.trim() === "Sign out")
          window.signOutReadAttempt++;
      },
      true,
    );
    const nativeFetch = window.fetch;
    window.fetch = function (...args) {
      const [input, init] = args;
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET");
      const url = input instanceof Request ? input.url : String(input);
      const path = new URL(url, window.location.href).pathname;
      if (
        window.signOutReadAttempt &&
        method.toUpperCase() === "GET" &&
        path.startsWith("/api/")
      ) {
        void window.recordSignOutRead(window.signOutReadAttempt, path);
      }
      return Reflect.apply(nativeFetch, this, args);
    };
  });
  return (attempt) =>
    starts
      .filter((start) => start.attempt === attempt)
      .map((start) => start.path);
}

export async function clickSignOut(page) {
  await openAccountMenu(page);
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .filter({ visible: true })
    .click();
  return page.evaluate(() => window.signOutReadAttempt);
}
