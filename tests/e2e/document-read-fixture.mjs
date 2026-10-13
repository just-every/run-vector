import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

// A native HTTP fixture serves the actual production coordinator. The delayed
// document and held response reproduce Chromium's provisional-navigation race.
export async function documentReadFixture() {
  const events = [];
  let releaseDocument,
    documentRequested,
    closeDocument,
    sendDocument,
    provisional = false;
  const documentSent = new Promise((resolve) => {
    sendDocument = resolve;
  });
  const documentClosed = new Promise((resolve) => {
    closeDocument = resolve;
  });
  const requested = new Promise((resolve) => {
    documentRequested = resolve;
  });
  const gate = new Promise((resolve) => {
    releaseDocument = resolve;
  });
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://fixture.invalid").pathname;
    const receipt = request.headers["x-read-receipt"];
    events.push({
      type: "request",
      path,
      receipt,
      documentId: request.headers["x-document-id"],
      provisional,
      time: Date.now(),
    });
    response.on("finish", () => {
      events.push({ type: "finish", path, receipt, time: Date.now() });
      if (path === "/app/next") sendDocument();
    });
    response.on("close", () => {
      events.push({ type: "close", path, receipt, time: Date.now() });
      if (path === "/app/next") closeDocument();
    });
    if (["/read-lifecycle.ts", "/document-read-lifecycle.ts"].includes(path)) {
      const source = await readFile(
        new URL("../../src/core/app" + path, import.meta.url),
        "utf8",
      );
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(stripTypeScriptTypes(source));
      return;
    }
    if (path === "/api/read") {
      if (provisional && receipt?.startsWith("/app/start:")) return;
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
      return;
    }
    if (path === "/app/next") {
      provisional = true;
      documentRequested();
      await gate;
    }
    if (path === "/no-content") {
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><title>Native document read fixture</title>
      <button id="cancel">Cancel navigation</button>
      <button id="reload" hidden>Reload this page</button>
      <script type="module">
      import { privateReads, documentReads } from '/read-lifecycle.ts';
      let serial = 0, cancelResume;
      const documentPath = location.pathname;
      document.body.dataset.documentId = crypto.randomUUID();
      for (const type of ['navigate','navigatesuccess','navigateerror']) navigation.addEventListener(type, e => {
        console.info('lifecycle:' + JSON.stringify({type, sameDocument:e.destination?.sameDocument, download:e.downloadRequest, paused:privateReads.paused}));
        e.signal?.addEventListener('abort', () => console.info('lifecycle:' + JSON.stringify({type:'abort',paused:privateReads.paused})));
      });
      for (const type of ['beforeunload','pagehide','pageshow']) addEventListener(type, e => console.info('lifecycle:' + JSON.stringify({type,persisted:e.persisted,paused:privateReads.paused})));
      const read = () => {
        if (privateReads.paused) {
          cancelResume ??= privateReads.onResume(() => {
            cancelResume(); cancelResume = null; read();
          });
          return;
        }
        privateReads.read('/api/read', async () => {
          const response = await fetch('/api/read', {headers: {
            'x-read-receipt': documentPath + ':' + (++serial),
            'x-document-id': document.body.dataset.documentId
          }});
          await response.json();
          document.body.dataset.reads = String(serial);
        }).catch(error => console.error(error.message));
      };
      document.body.dataset.ready = 'true';
      document.body.dataset.navigation = String('navigation' in window);
      read();
      setInterval(read, 100);
      document.querySelector('#cancel').onclick = () => {
        navigation.addEventListener('navigate', e => e.preventDefault(), {once:true});
        location.assign('/app/cancelled');
      };
      documentReads.subscribe(() => {
        document.querySelector('#reload').hidden = !documentReads.pending;
        if (documentReads.pending) document.querySelector('#reload').focus();
        if (documentReads.pending) console.info('lifecycle:' + JSON.stringify({type:'pending-ready'}));
      });
      document.querySelector('#reload').onclick = () => {
        console.info('lifecycle:' + JSON.stringify({type:'reload-click',focused:document.activeElement.id}));
        documentReads.reload();
        console.info('lifecycle:' + JSON.stringify({type:'reload-returned',paused:privateReads.paused}));
      };
      addEventListener('keydown', e => console.info('lifecycle:' + JSON.stringify({type:'keydown',key:e.key,focused:document.activeElement.id})));
      document.addEventListener('fixture-pause', () => privateReads.pause());
      document.addEventListener('fixture-resume', () => privateReads.resume());
      addEventListener('pageshow', e => { document.body.dataset.restored = String(e.persisted); });
      </script>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    base: "http://127.0.0.1:" + server.address().port,
    events,
    requested,
    documentClosed,
    documentSent,
    releaseDocument,
    async close() {
      releaseDocument();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
