import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hero } from "../src/core/app/site/home/copy/hero.ts";

const seed = JSON.parse(readFileSync(new URL("../seed.json", import.meta.url), "utf8"));

// Naming the products Vector is an alternative to is allowed (owner decision, 12 October 2026); comparing against them is not.
const comparative = /\b(better|faster|cheaper|simpler|more \w+|less \w+) than\b|\bunlike\b|\bversus\b|\bvs\.?\s|\boutperforms?\b|\bbeats?\b/i;

test("seed metadata names alternatives plainly and makes no comparative claim", () => {
  assert.equal(Array.isArray(seed.replaces), true);
  for (const name of seed.replaces) assert.match(name, /^[A-Z][A-Za-z0-9]*( [A-Za-z0-9]+)?$/, name);
  assert.doesNotMatch(`${seed.description} ${seed.replaces.join(" ")}`, comparative);
});

test("the homepage alternative line lists every replaced name and makes no comparative claim", () => {
  const line = hero.alternative;
  for (const name of seed.replaces) assert.ok(line.includes(name), name);
  assert.doesNotMatch(line, comparative);
});

test("seed metadata reserves the portable-data claim until implementation acceptance", () => {
  assert.equal(seed.capabilities.some((capability: { id: string }) => capability.id === "portable-data"), false);
});

test("seed metadata does not advertise an unimplemented import limit or completion event", () => {
  assert.equal(Object.hasOwn(seed.limits, "importRecordsPerRun"), false);
  assert.equal(seed.extensionPoints.events.includes("import.completed.v1"), false);
});

test("seed metadata preserves delivered browsing and collaboration declarations", () => {
  assert.equal(seed.limits.bulkEditIssuesPerOperation, 250);
  assert.equal(seed.limits.savedViewsPerOperator, 100);
  assert.equal(seed.limits.labels, 500);
  assert.equal(seed.limits.labelsPerIssue, 20);
  const browsing = seed.capabilities.find((capability: { id: string }) => capability.id === "search-and-views");
  for (const clause of ["VIEW-001", "VIEW-002", "VIEW-003", "VIEW-004", "VIEW-005", "CMD-001", "SEARCH-001", "SEARCH-002", "SEARCH-003"]) {
    assert.equal(browsing.clauses.includes(clause), true, clause);
  }
});
