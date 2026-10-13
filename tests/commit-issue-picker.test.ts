import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import ts from "typescript";
import * as commitmentChoices from "../src/core/features/cycles/ui/commitment-choices.ts";

type Element = { type: string; props: Record<string, any> };
const sourceUrl = new URL(
  "../src/core/features/cycles/ui/commit-issue-form.tsx",
  import.meta.url,
);
const require = createRequire(sourceUrl);
const compiled = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function candidate(
  identifier: string,
  category = "started",
  teamId = "team-a",
) {
  return {
    id: identifier,
    identifier,
    title: `Customer delivery ${identifier}`,
    team: { id: teamId },
    status: { category },
  };
}

// Execute the real TSX and its event handlers. Only hooks and the API resource
// are controlled here; actual browser/API selection is covered by the journey.
function harness(overrides: Record<string, unknown> = {}) {
  const states: any[] = [];
  let cursor = 0;
  const calls: string[] = [];
  const requests: string[] = [];
  let reloads = 0;
  const resource = {
    data: {
      issues: [
        candidate("FLW-101"),
        candidate("FLW-102", "unstarted"),
        candidate("FLW-103", "completed"),
        candidate("FLW-104", "canceled"),
        candidate("FLW-105", "duplicate"),
        candidate("OTH-101", "started", "team-b"),
      ],
      total: 70,
      pageSize: 50,
    },
    loading: false,
    error: null as Error | null,
    reload: () => reloads++,
  };
  const useState = (initial: any) => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [
      states[index],
      (next: any) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      },
    ];
  };
  const exports: Record<string, any> = {};
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === "react")
        return {
          ...React,
          useState,
          useId: () => useState(`picker-${cursor}`)[0],
          useRef: () => useState({ current: null })[0],
          useEffect: () => {},
        };
      if (name.endsWith("/api-client"))
        return {
          useApiResource: (url: string) => {
            requests.push(url);
            return resource;
          },
        };
      if (name.endsWith("/list-schema")) return {};
      if (name === "./commitment-choices") return commitmentChoices;
      return require(name);
    },
  });
  const props = {
    teamId: "team-a",
    teamArchived: false,
    pending: false,
    commit: async (identifier: string) => {
      calls.push(identifier);
    },
    ...overrides,
  };
  return {
    resource,
    calls,
    requests,
    props,
    get reloads() {
      return reloads;
    },
    render: () => {
      cursor = 0;
      return exports.CommitIssueForm(props) as Element;
    },
  };
}

function elements(node: any): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}
const input = (tree: Element) =>
  elements(tree).find((el) => el.type === "input")!;
const options = (tree: Element) =>
  elements(tree).filter((el) => el.props.role === "option");
const text = (node: any): string => {
  if (Array.isArray(node))
    return node.map(text).join(" ").replace(/\s+/g, " ").trim();
  if (node && typeof node === "object") return text(node.props?.children);
  return node == null || typeof node === "boolean" ? "" : String(node);
};
function key(field: Element, name: string) {
  let prevented = false;
  field.props.onKeyDown({
    key: name,
    nativeEvent: { isComposing: false },
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {},
  });
  return prevented;
}
function search(h: ReturnType<typeof harness>, value = "Customer delivery") {
  input(h.render()).props.onChange({ target: { value } });
  return h.render();
}

test("[CYCLE-002] rendered bounded choices show eligible identifiers and titles and mouse selection commits the actual identifier", async () => {
  const h = harness();
  let tree = search(h);
  const list = elements(tree).find((el) => el.props.role === "listbox");
  assert.ok(list, "eligible results must be a rendered listbox");
  assert.equal(list.props["aria-label"], "Eligible cycle issues");
  assert.equal(input(tree).props.role, "combobox");
  assert.equal(input(tree).props["aria-controls"], list.props.id);
  assert.equal(input(tree).props["aria-expanded"], true);
  assert.deepEqual(
    options(tree).map((el) => text(el)),
    ["FLW-101 Customer delivery FLW-101", "FLW-102 Customer delivery FLW-102"],
  );
  assert.match(h.requests.at(-1)!, /q=Customer\+delivery/);
  assert.match(text(tree), /Showing up to 50 search results/);
  assert.equal(options(tree)[1].props.type, "button");
  options(tree)[1].props.onClick();
  tree = h.render();
  assert.equal(input(tree).props.value, "FLW-102");
  assert.equal(input(tree).props["aria-expanded"], false);
  assert.deepEqual(h.calls, []);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(h.calls, ["FLW-102"]);
  assert.equal(h.reloads, 1);
});

test("[CYCLE-002] arrow keys highlight choices and Enter selects without submitting the search title", async () => {
  const h = harness();
  let tree = search(h);
  assert.equal(key(input(tree), "ArrowDown"), true);
  tree = h.render();
  assert.equal(options(tree)[0].props["aria-selected"], true);
  assert.equal(
    input(tree).props["aria-activedescendant"],
    options(tree)[0].props.id,
  );
  key(input(tree), "ArrowDown");
  tree = h.render();
  assert.equal(options(tree)[1].props["aria-selected"], true);
  assert.equal(key(input(tree), "Enter"), true);
  tree = h.render();
  assert.equal(input(tree).props.value, "FLW-102");
  assert.deepEqual(h.calls, []);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(h.calls, ["FLW-102"]);
  search(h);
  key(input(h.render()), "ArrowUp");
  assert.equal(options(h.render())[1].props["aria-selected"], true);
  key(input(h.render()), "Escape");
  assert.equal(input(h.render()).props["aria-expanded"], false);
  key(input(h.render()), "ArrowDown");
  assert.equal(input(h.render()).props["aria-expanded"], true);
  assert.equal(options(h.render())[0].props["aria-selected"], true);
  key(input(h.render()), "Tab");
  assert.equal(input(h.render()).props["aria-expanded"], false);
});

test("[CYCLE-002] typed input stays exact with no title-to-identifier fallback", async () => {
  const h = harness();
  const tree = search(h, "  Literal title remains literal  ");
  assert.equal(key(input(tree), "Enter"), false);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(h.calls, ["Literal title remains literal"]);
});

test("[CYCLE-002] pending, archived, failed, loading and empty states cannot offer stale selectable issues", async () => {
  for (const overrides of [{ pending: true }, { teamArchived: true }]) {
    const h = harness(overrides);
    const tree = search(h);
    assert.equal(options(tree).length, 0);
    assert.equal(
      elements(tree).find((el) => el.type === "fieldset")!.props.disabled,
      true,
    );
    await tree.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(h.calls, []);
  }
  const h = harness();
  search(h);
  h.resource.loading = true;
  assert.equal(options(h.render()).length, 0);
  assert.match(text(h.render()), /Finding issues…/);
  h.resource.loading = false;
  h.resource.error = new Error("Unable to read issue choices");
  assert.equal(options(h.render()).length, 0);
  const retry = elements(h.render()).find(
    (el) => text(el) === "Retry issue choices",
  )!;
  retry.props.onClick();
  assert.equal(h.reloads, 1);
  h.resource.error = null;
  h.resource.data.issues = [];
  assert.equal(options(h.render()).length, 0);
  assert.match(text(h.render()), /No eligible issues in these results\./);
});
