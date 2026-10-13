import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openDisclosures } from "./ui-controls-checks.mjs";

// Functional journeys keep lightweight checkpoints; the core runtime owns the
// single representative accessibility/overflow audit.
export function createStateRecorder(page, evidence, results) {
  return async function recordState(name) {
    await page.locator("main").waitFor();
    await page.waitForFunction(() =>
      ![...document.querySelectorAll("main [role=status]")].some((element) =>
        /^Loading|^Saving(?:…|\.\.\.| commitment)/.test(element.textContent.trim()),
      ) && !document.querySelector('main [aria-busy="true"]'),
    );
    await openDisclosures(page);
    const state = { name, url: new URL(page.url()).pathname };
    results.push(state);
    await writeFile(resolve(evidence, "states.json"), JSON.stringify(results, null, 2) + "\n");
    return state;
  };
}
export async function exportData(runtime, evidence, width) {
  const tables = [
    "workspace_settings",
    "operators",
    "teams",
    "workflow_statuses",
    "projects",
    "project_activity",
    "cycles",
    "labels",
    "issues",
    "issue_labels",
    "issue_activity",
    "team_issue_sequences",
    "saved_views",
    "audit_records",
    "administration_audit_details",
  ];
  const data = Object.fromEntries(
    tables.map((table) => [table, runtime.sql(`SELECT * FROM ${table}`)]),
  );
  const bytes = JSON.stringify({ width, data }, null, 2) + "\n";
  const file = `database-${width}.json`;
  await writeFile(resolve(evidence, file), bytes);
  return { file };
}
