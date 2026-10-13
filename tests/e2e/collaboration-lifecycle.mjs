// Read-only lifecycle evidence; never intercepts requests or changes outcomes.
let operation = "setup";
const entries = [];
function safeUrl(value) {
  const url = new URL(value);
  return url.origin + url.pathname;
}
export function lifecycleBoundary(name, phase, page) {
  entries.push({ type: "boundary", name, phase, timestamp: Date.now(), currentUrl: page ? safeUrl(page.url()) : null, operation });
}
export async function lifecycleOperation(name, run, page) {
  const previous = operation;
  operation = name;
  lifecycleBoundary(name, "start", page);
  try { return await run(); }
  finally { lifecycleBoundary(name, "finish", page); operation = previous; }
}
export function observeLifecycle(page, identity) {
  const requests = new WeakMap();
  let sequence = 0;
  const record = (type, request, extra = {}) => {
    entries.push({ type, identity, requestId: requests.get(request), operation, timestamp: Date.now(), currentUrl: safeUrl(page.url()), method: request.method(), url: safeUrl(request.url()), ...extra });
  };
  page.on("request", request => { requests.set(request, ++sequence); record("request-start", request); });
  page.on("requestfinished", request => record("request-finish", request));
  page.on("requestfailed", request => record("request-failure", request, { failure: request.failure() }));
  page.on("response", response => record("response", response.request(), { status: response.status() }));
}
export function lifecycleEvidence() { return entries; }
