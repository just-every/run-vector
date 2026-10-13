import { auditProofState } from "./ui-proof-state.mjs";
import { auditReviewAdministration } from "./ui-review-administration.mjs";
import { auditReviewIssueLayout } from "./ui-review-issue-layout.mjs";

export async function auditReviewUx({
  page,
  base,
  opts,
  runCase = async (_name, run) => run(),
}) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const check = (name, route, run) =>
      runCase(`${width}-${name}`, async () => {
        await page.goto(base + route);
        await page.locator("main").waitFor();
        const measurements = await run();
        if (measurements)
          console.info(
            JSON.stringify({ name: `${width}-${name}`, measurements }),
          );
        await auditProofState(page, `${width}-${name}`, { measurements });
      });
    await auditReviewAdministration({ page, width, opts, check });
    await auditReviewIssueLayout({ page, width, opts, check });
  }
}
