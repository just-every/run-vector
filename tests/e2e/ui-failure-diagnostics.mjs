import { writeFile } from "node:fs/promises";

const routeSegments = new Set([
  "api", "app", "issues", "board", "current", "my-work", "projects",
  "views", "preferences", "options", "notifications", "count", "mentions",
  "search", "subscription", "github", "discussion", "comments", "files",
  "bulk", "parent", "dependencies", "duplicate", "settings", "intake",
  "new", "setup", "signin", "_serverFn",
]);
const queryFields = new Set([
  "q", "category", "status", "priority", "assignee", "team", "project",
  "cycle", "label", "due", "blocked", "parent", "sort", "grouping",
  "offset", "pageSize", "revision",
]);
function safePath(path) {
  return path.split("/").map(segment =>
    !segment || routeSegments.has(segment) ? segment : ":resource",
  ).join("/");
}

// Observe transport events without intercepting traffic, consuming bodies or
// changing focus. Only the failing run publishes these bounded diagnostics.
export function observeUiFailure(page, origin, resourceTypes = ["fetch", "xhr"]) {
  const started = performance.now(), events = [], failures = [], pending = new Map();
  let sequence = 0;
  const elapsed = () => Math.round(performance.now() - started);
  const append = event => {
    events.push({ atMs: elapsed(), ...event });
    if (events.length > 600) events.shift();
  };
  page.on("request", request => {
    if (!resourceTypes.includes(request.resourceType())) return;
    const url = new URL(request.url());
    const row = { id: ++sequence, method: request.method(), sameOrigin: url.origin === origin,
      path: url.origin === origin ? safePath(url.pathname) : ":external",
      queryFields: [...url.searchParams.keys()].filter(key => queryFields.has(key)),
      phase: "request", startedAtMs: elapsed() };
    pending.set(request, row);
    append({ event: "request", ...row });
  });
  page.on("response", response => {
    const row = pending.get(response.request());
    if (row) {
      row.phase = "response";
      row.status = response.status();
      append({ event: "response", ...row });
    }
  });
  page.on("requestfinished", request => {
    const row = pending.get(request);
    if (row) append({ event: "finished", ...row });
    pending.delete(request);
  });
  page.on("requestfailed", request => {
    const row = pending.get(request);
    if (row) {
      const code = request.failure()?.errorText;
      const failure = { event: "failed", ...row,
        code: /^net::[A-Z_]+$/.test(code ?? "") ? code : "request_failed" };
      failures.push({ atMs: elapsed(), ...failure });
      append(failure);
    }
    pending.delete(request);
  });
  return { events, failures, pending };
}

// The Worker server logs each completed request; keep method, route shape, status and
// duration only, so a hung read shows whether the Worker ever answered it.
function workerRequests(log) {
  const rows = [];
  for (const line of String(log ?? "").replace(/\x1b\[[0-9;]*m/g, "").split("\n")) {
    const match = line.match(/\[mf:info\] ([A-Z]+) (\/\S*) (\d{3})\b.*\((\d+)ms\)/);
    if (match) rows.push({ method: match[1], path: safePath(match[2].split("?")[0]), status: Number(match[3]), ms: Number(match[4]) });
  }
  return rows.slice(-400);
}

export async function writeUiFailureDiagnostic(file, browser, observed, workerLog) {
  const pages = [];
  for (const [contextIndex, context] of browser.contexts().entries()) {
    for (const [pageIndex, page] of context.pages().entries()) {
      let state;
      try {
        state = await page.evaluate(async () => {
          const list = document.querySelector("main[data-list-query]");
          const normalize = search => [...new URLSearchParams(search)].map(String).sort().join("&");
          let animationFrame = false;
          await new Promise(resolve => {
            const frame = requestAnimationFrame(() => { animationFrame = true; clearTimeout(timer); resolve(); });
            const timer = setTimeout(() => { cancelAnimationFrame(frame); resolve(); }, 250);
          });
          return { path: location.pathname, visibility: document.visibilityState,
            focused: document.hasFocus(), animationFrame,
            queryKeys: [...new URLSearchParams(location.search).keys()],
            listQueryKeys: [...new URLSearchParams(list?.dataset.listQuery ?? "").keys()],
            listQueryMatchesLocation: list ? normalize(list.dataset.listQuery) === normalize(location.search) : null,
            listState: list?.dataset.listState === "loading" ? "loading" : list?.dataset.listState === "ready" ? "ready" : null,
            lists: document.querySelectorAll("main[data-list-query]").length,
            pagination: document.querySelectorAll(".issues-pagination").length,
            busy: document.querySelectorAll('main [aria-busy="true"]').length,
            statuses: document.querySelectorAll('main [role="status"]').length,
            alerts: document.querySelectorAll('main [role="alert"]').length };
        });
        state.path = safePath(state.path);
        state.queryKeys = state.queryKeys.filter(key => queryFields.has(key));
        state.listQueryKeys = state.listQueryKeys.filter(key => queryFields.has(key));
      } catch { state = { unavailable: true, closed: page.isClosed() }; }
      pages.push({ contextIndex, pageIndex, ...state });
    }
  }
  await writeFile(file, JSON.stringify({ schemaVersion: 1, pages,
    events: observed.events, failures: observed.failures,
    pending: [...observed.pending.values()], workerRequests: workerRequests(workerLog) }, null, 2) + "\n");
}
