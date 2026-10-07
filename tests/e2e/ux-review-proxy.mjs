// Local IAB recovery proof only: this transparently forwards native requests to
// the owned emitted Worker and injects an explicitly selected synthetic GET fault.
// It does not create sessions, rewrite browser identity/origin, or alter mutations.
import http from "node:http";
import { readFileSync } from "node:fs";

const faultFile = "/tmp/vector-ux-fault.json";
const server = http.createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://127.0.0.1:15938").pathname;
  let fault;
  try {
    fault = JSON.parse(readFileSync(faultFile, "utf8"));
  } catch {}
  const permitted = /^\/api\/(current|my-work|issues\/FLW-\d+)$/.test(path);
  if (
    request.method === "GET" &&
    permitted &&
    fault?.path === path &&
    [401, 403, 404, 410, 503].includes(fault.status)
  ) {
    response.writeHead(fault.status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify({ message: "Synthetic local recovery test response." }),
    );
    return;
  }
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 15940,
      method: request.method,
      path: request.url,
      headers: { ...request.headers, connection: "close" },
    },
    (received) => {
      response.writeHead(received.statusCode ?? 502, received.headers);
      received.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent)
      response.writeHead(502, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
    response.end(
      JSON.stringify({
        message: "The owned local review Worker is unavailable.",
      }),
    );
  });
  request.pipe(upstream);
});
server.listen(15938, "127.0.0.1", () =>
  console.log(
    "Local Vector recovery fixture: 15938 → 15940. No identity injection.",
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
