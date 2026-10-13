import { chromium } from "@playwright/test";
import { createUiRuntime } from "./ui-runtime-support.mjs";
import { signIn, openAuthenticatedPage } from "./ui-runtime-auth.mjs";
import { exerciseConfirmationRequests } from "./ui-confirmation-requests.mjs";

const runtime = createUiRuntime();
let browser;
try {
  runtime.initialize();
  runtime.start();
  await runtime.ready();
  const { cookie } = await signIn(runtime);
  browser = await chromium.launch({ headless: true });
  const page = await openAuthenticatedPage(browser, cookie, runtime.base);
  const headers = {
    Cookie: cookie,
    Origin: runtime.base,
    "Content-Type": "application/json",
  };
  const options = await runtime.req("/api/options", { headers });
  if (!options.ok) throw new Error(`Options failed: ${options.status}`);
  await exerciseConfirmationRequests({
    page,
    base: runtime.base,
    req: runtime.req,
    opts: await options.json(),
    headers,
  });
  console.info(
    "[Vector confirmation] Native request counts and destinations passed through 12 saved decision states.",
  );
} catch (error) {
  console.error(runtime.log);
  throw error;
} finally {
  if (browser) await browser.close();
  await runtime.stop();
}
