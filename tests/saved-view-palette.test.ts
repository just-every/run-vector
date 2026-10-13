import assert from "node:assert/strict";
import test from "node:test";
import { savedViewPaletteEntries } from "../src/core/features/search/ui/saved-view-entries.ts";
import { paletteEntries } from "../src/core/features/search/ui/data.ts";

const result = {
  issues: [{ id: "issue", identifier: "RND-1", title: "Release" }],
  projects: [{ id: "project", name: "Release" }],
  savedViews: [
    { id: "private-view", name: "Release private", isShared: false },
    { id: "shared-view", name: "Release shared", isShared: true },
  ],
};

test("saved-view palette entries retain server-authorized identity and visibility", () => {
  assert.deepEqual(savedViewPaletteEntries(result, "release"), [
    {
      id: "view:private-view",
      group: "Saved views",
      title: "Release private",
      detail: "Private saved view",
      destination: "/app/views/$viewId",
      params: { viewId: "private-view" },
    },
    {
      id: "view:shared-view",
      group: "Saved views",
      title: "Release shared",
      detail: "Shared saved view",
      destination: "/app/views/$viewId",
      params: { viewId: "shared-view" },
    },
  ]);
  const peer = {
    ...result,
    savedViews: result.savedViews.filter((view) => view.isShared),
  };
  assert.deepEqual(
    savedViewPaletteEntries(peer, "release").map((entry) => entry.params),
    [{ viewId: "shared-view" }],
  );
  assert.deepEqual(savedViewPaletteEntries(null, "release"), []);
  assert.deepEqual(savedViewPaletteEntries(result, "   "), []);
});

test("composing palette modules exposes issues, projects and saved views without changing static command semantics", () => {
  const entries = [
    ...paletteEntries(result, "release"),
    ...savedViewPaletteEntries(result, "release"),
  ];
  assert.deepEqual(
    entries.map((entry) => entry.group),
    ["Issues", "Projects", "Saved views", "Saved views"],
  );
  assert.equal(
    entries.filter((entry) => entry.destination === "/app/views/$viewId")
      .length,
    2,
  );
  assert.ok(
    paletteEntries(null, "").some(
      (entry) => entry.destination === "/app/search",
    ),
  );
});
