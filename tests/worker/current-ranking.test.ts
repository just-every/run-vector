import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { setupAdministration } from "./administration-fixture";

contractWith(it, "CURR-007", "Current resolves the entire ranking tie chain despite contrary lower-ranked fields", async () => {
  const f = await setupAdministration();
  const statusId = f.initial.teams[0].statuses.find((s) => s.category === "started")!.id;
  const oldest = "2030-06-01T00:00:00.000Z", newest = "2030-06-03T00:00:00.000Z";
  // Creation order deliberately opposes identifier order at the final tie (10 before 2).
  // Every earlier comparator also has a pair whose lower-ranked fields favor its loser.
  const inputs: Array<[string, string | null, string]> = [
    ["low", "2030-05-01", newest],
    ["medium", "2030-06-06", oldest],
    ["none", "2030-04-01", newest],
    ["medium", "2030-06-06", newest],
    ["medium", "2030-06-01", oldest],
    ["medium", "2030-06-03", newest],
    ["medium", "2030-06-04", oldest],
    ["medium", "2030-06-05", newest],
    ["medium", null, newest],
    ["medium", "2030-06-06", oldest],
    ["high", "2030-06-20", newest],
    ["urgent", null, oldest],
  ];
  const issues = [];
  for (const [priority, dueDate, updatedAt] of inputs) {
    const issue = await f.create({ title: `Rank candidate ${issues.length + 1}`, statusId, priority, dueDate });
    // Equal timestamps cannot reliably be authored through wall-clock HTTP requests.
    await env.DB.prepare("UPDATE issues SET updated_at=? WHERE id=?").bind(updatedAt, issue.id).run();
    issues.push(issue);
  }
  const response = await f.call("/current?at=2030-06-04T12:00:00.000Z");
  expect(response.status).toBe(200);
  const current = await response.json() as { sections: Record<string, Array<{ identifier: string }>> };
  expect(current.sections.now.map((issue) => issue.identifier)).toEqual(
    [12, 11, 5, 6, 7, 8, 4, 10, 2, 9, 1, 3].map((position) => issues[position - 1].identifier),
  );
  expect(Object.values(current.sections).flat()).toHaveLength(issues.length);
});
