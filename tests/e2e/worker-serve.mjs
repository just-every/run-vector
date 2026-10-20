// Serves the built Worker straight from Miniflare, the runtime `wrangler dev`
// itself starts, without wrangler's ProxyWorker hop. That hop reuses keep-alive
// connections to the Worker; both ends idle out at 5 s, and a PATCH or POST
// written as the Worker closes such a connection fails as a 500 ("Network
// connection lost") because the proxy retries only GET and HEAD. Browsers and
// Node's fetch resend or retire reused sockets safely on a direct connection.
// Takes the `wrangler dev` arguments the harnesses already pass.
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { unstable_getMiniflareWorkerOptions } from "wrangler";

const require = createRequire(import.meta.url);
const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require(
  createRequire(require.resolve("wrangler")).resolve("miniflare"),
);

const args = process.argv.slice(2), vars = {};
let config, host = "127.0.0.1", port, persist;
for (let i = 0; i < args.length; i++) {
  const value = () => args[++i];
  switch (args[i]) {
    case "--config": config = resolve(value()); break;
    case "--ip": host = value(); break;
    case "--port": port = Number(value()); break;
    case "--persist-to": persist = resolve(value(), "v3"); break;
    case "--var": { const pair = value(), at = pair.indexOf(":"); vars[pair.slice(0, at)] = pair.slice(at + 1); break; }
    case "--local": case "--test-scheduled": break;
    case "--inspector-port": i++; break;
    default: throw new Error("worker-serve: unsupported argument " + args[i]);
  }
}
if (!config || !port || !persist) throw new Error("worker-serve: --config, --port and --persist-to are required");

const { workerOptions, main } = unstable_getMiniflareWorkerOptions(config);
// The built config is no_bundle with ESModule rules for **/*.js and **/*.mjs:
// like wrangler, load every runtime module beside the entry, entry first.
// The enforcing outbound transport also imports a compiled TLS WebAssembly module.
const root = dirname(config), entry = resolve(root, main);
const modules = readdirSync(root, { recursive: true })
  .filter((name) => /\.(?:m?js|wasm)$/.test(name)).map((name) => join(root, name))
  .sort((a, b) => (b === entry) - (a === entry))
  .map((path) => ({ type: path.endsWith(".wasm") ? "CompiledWasm" : "ESModule", path }));
const channelEdge=process.env.VECTOR_CHANNEL_EDGE?(await import('./integrations/channel-provider-edge.mjs')).channelProviderEdge:undefined;
const worker = new Miniflare(convertV4MiniflareOptions({
  host, port,
  rootPath: root,
  resourcePersistencePath: persist,
  unsafeTriggerHandlers: true,
  unsafeLocalExplorer: process.env.X_LOCAL_EXPLORER !== "false", // wrangler's default
  logRequests: true,
  log: new Log(LogLevel.INFO),
  workers: [{ name: "vector-local", modulesRoot: root, modules, ...workerOptions, ...(channelEdge?{outboundService:channelEdge}:{}), bindings: { ...workerOptions.bindings, ...vars } }],
}));
await worker.ready;
console.log(`worker-serve ready on http://${host}:${port}`);
const stop = () => worker.dispose().finally(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
