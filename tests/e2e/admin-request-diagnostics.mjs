import { chmod, writeFile } from "node:fs/promises";
import { exceptionClassification } from "./worker-exception-diagnostics.mjs";

// This observer never reads bodies or headers and never changes a request,
// response, the browser error arrays, or any existing acceptance assertion.
export function createAdminRequestDiagnostics() {
  const requests = [];
  let phase = "bootstrap",
    sequence = 0;
  return {
    phase(value) {
      phase = value;
    },
    observe(page, width) {
      const pending = new WeakMap();
      page.on("request", (request) => {
        const row = {
          id: ++sequence,
          page: "main-admin",
          width,
          phase,
          method: request.method(),
          pathname: new URL(request.url()).pathname,
          requestedAt: performance.now(),
          status: null,
          completion: "pending",
        };
        pending.set(request, row);
        requests.push(row);
      });
      page.on("response", (response) => {
        const row = pending.get(response.request());
        if (row) {
          row.status = response.status();
          row.respondedAt = performance.now();
          row.responsePhase = phase;
        }
      });
      const complete = (request, completion) => {
        const row = pending.get(request);
        if (row) {
          row.completion = completion;
          row.completedAt = performance.now();
          row.completionPhase = phase;
        }
      };
      page.on("requestfinished", (request) => complete(request, "finished"));
      page.on("requestfailed", (request) => complete(request, "failed"));
    },
    snapshot() {
      return structuredClone(requests);
    },
  };
}

export async function writeAdminFailureReceipt(
  path,
  { error, requests, workerExceptions, checks },
) {
  const receipt = {
    passed: false,
    checksCompleted: checks.length,
    checksFailed: checks.filter((check) => !check.passed).length,
    failure: exceptionClassification(error, []),
    requests,
    workerExceptions,
  };
  await writeFile(path, JSON.stringify(receipt, null, 2) + "\n", {
    mode: 0o600,
  });
  await chmod(path, 0o600);
}
