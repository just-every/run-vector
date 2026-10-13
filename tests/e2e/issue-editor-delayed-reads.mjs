import assert from "node:assert/strict";
import { fetchHeld } from "./route-fetch.mjs";

// Hold genuine GET receipts after the Worker has answered. No response body,
// status or version is synthesized; the race concerns delivery to the client.
export async function delayIssueReads(page, path) {
  const reads = [];
  let retiring = false;
  const matches = url => new URL(url).pathname === path;
  const terminal = (request, kind) => {
    const read = reads.find(read => read.request === request);
    if (read) read.terminal = kind;
  };
  const finished = request => terminal(request, "finished");
  const failed = request => terminal(request,
    request.failure()?.errorText === "net::ERR_ABORTED" ? "canceled" : "failed");
  page.on("requestfinished", finished);
  page.on("requestfailed", failed);
  const healthy = () => {
    for (const read of reads) if (read.error) throw read.error;
  };
  const handler = async route => {
    if (retiring) return route.fallback();
    if (route.request().method() !== "GET") return route.fallback();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const read = { request: route.request(), release, issue: null, settled: false, terminal: null };
    reads.push(read);
    try {
      const response = await fetchHeld(route);
      assert.equal(response.status(), 200, `delayed GET ${path}`);
      const body = await response.text();
      read.issue = JSON.parse(body);
      await gate;
      // Mutation refreshes drain admitted reads before fetching the next
      // snapshot. Normal delivery must succeed; only failed-journey retirement
      // explicitly aborts an owned route, with its own terminal event below.
      if (retiring && !read.terminal) await route.abort("aborted");
      else if (retiring) return;
      else await route.fulfill({ response, body });
    } catch (error) {
      read.error = error;
    } finally {
      read.settled = true;
    }
  };
  await page.route(matches, handler);
  return {
    async wait(index, version) {
      for (let waited = 0; !reads[index]?.issue; waited += 20) {
        healthy();
        assert.ok(waited < 20000, `GET ${path}: missing delayed receipt ${index}`);
        await page.waitForTimeout(20);
      }
      healthy();
      assert.equal(reads[index].issue.version, version, `GET ${path}: genuine delayed version`);
      assert.equal(`/api/issues/${reads[index].issue.identifier}`, path, `GET ${path}: genuine delayed identity`);
      return reads[index].issue;
    },
    async release(index) {
      assert.ok(reads[index], `GET ${path}: receipt ${index} exists`);
      reads[index].release();
      for (let waited = 0; !reads[index].settled || !reads[index].terminal; waited += 20) {
        healthy();
        assert.ok(waited < 20000, `GET ${path}: receipt ${index} was not released`);
        await page.waitForTimeout(20);
      }
      healthy();
      assert.equal(reads[index].terminal, "finished", `GET ${path}: normal delivery completes without cancellation`);
    },
    async close(afterFailure = false) {
      retiring = afterFailure;
      for (const read of reads) read.release();
      try {
        for (let waited = 0; reads.some(read => !read.settled || !read.terminal); waited += 20) {
          healthy();
          assert.ok(waited < 20000, `GET ${path}: outstanding delayed receipts during cleanup`);
          await page.waitForTimeout(20);
        }
        healthy();
        for (const read of reads) assert.ok(read.terminal === "finished" ||
          (retiring && read.terminal === "canceled"), `GET ${path}: unexpected request failure`);
      } finally {
        await page.unroute(matches, handler);
        page.off("requestfinished", finished);
        page.off("requestfailed", failed);
      }
    },
  };
}

export async function writingReceipt(page, path, action, status = 200) {
  const pending = page.waitForResponse(response =>
    new URL(response.url()).pathname === path && response.request().method() === "PATCH",
  );
  await action();
  const response = await pending;
  assert.equal(response.status(), status, `writing PATCH ${path}, expectedVersion ${response.request().postDataJSON().expectedVersion}`);
  const issue = await response.json();
  if (status === 200) await page.getByRole("button", { name: "Edit issue", exact: true }).waitFor();
  else await page.locator(".issue-writing-editor [role=alert]").waitFor();
  return { issue, request: response.request().postDataJSON() };
}
