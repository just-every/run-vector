import { withDemo } from '../../../vendor/base/demo/index.mjs';
import { seedDemo } from '../../demo';
import { isDependencyPath } from '../features/auth/dependencies.server';
import { scheduled } from './scheduled';
export { VectorRestoreCoordinator } from '../features/data/restore-coordinator';
import { editorDocument } from '../editor/config.server';
import { operatorProjectionAdmitted } from '../features/auth/projection-admission';
import { developmentKeyResponse } from '../features/auth/development.server';
import { requireOperator, safeReturnTo } from "../features/auth/service";
import start from "@tanstack/react-start/server-entry";
import { createServerApp, type WorkerBindings } from "./server";
import { isViteDevelopmentAsset } from "./vite-development-path";
import { staticAssetResponse } from '../../base/static-assets';
import { renderAsOperator } from './document-operator.server';
import { encodePrivateDocument } from './document-encoding.server';
const app = createServerApp();
export async function handleRequest(
  request: Request,
  env: WorkerBindings,
): Promise<Response> {
  const url = new URL(request.url);
  if (env.APP_ORIGIN && url.host !== new URL(env.APP_ORIGIN).host)
    return new Response("Not found", { status: 404 });
  const asset = await staticAssetResponse(request, env);
  if (asset) {
    // Vite embeds the content hash in these URLs; a new build gets a new URL.
    if (/^\/assets\/[^/]+-[\w-]{8}\.(?:js|css)$/.test(url.pathname) && (asset.ok || asset.status === 304)) {
      const immutable = new Response(asset.body, asset);
      immutable.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return immutable;
    }
    return asset;
  }
  if (url.pathname === '/__dev/key') return await developmentKeyResponse(env, request) ?? new Response('Not found', {status:404});
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/rer-theme.css" ||
    (import.meta.env.DEV && isViteDevelopmentAsset(url.pathname))
  )
    return env.ASSETS.fetch(request);
  if (
    isDependencyPath(url.pathname) ||
    url.pathname === "/" ||
    url.pathname === "/setup/state" ||
    url.pathname === "/health" ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  )
    return app.fetch(request, env);
  const privateRequest = url.pathname === "/app" || url.pathname.startsWith("/app/") || url.pathname.startsWith("/_serverFn/");
  const timings: string[] = [];
  const timed = async <T>(name: string, run: () => T | Promise<T>) => {
    const started = performance.now();
    try { return await run(); }
    finally { timings.push(`${name};dur=${(performance.now() - started).toFixed(1)}`); }
  };
  const admitted = privateRequest ? await timed('auth', () => requireOperator(env, request, true)) : null;
  const workspace = admitted?.workspaceId ?? null;
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
    if (!admitted) {
      const target = new URL("/signin", url);
      target.searchParams.set(
        "returnTo",
        safeReturnTo(url.pathname + url.search),
      );
      return new Response(null, {
        status: 302,
        headers: {
          Location: target.pathname + target.search,
          "Cache-Control": "no-store",
        },
      });
    }
  }
  if (
    !url.pathname.startsWith("/_serverFn/") &&
    !["GET", "HEAD"].includes(request.method)
  )
    return new Response("Not found", { status: 404 });
  if (url.pathname.startsWith("/_serverFn/")) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    if (
      (origin && origin !== env.APP_ORIGIN) ||
      site === "cross-site" ||
      site === "same-site"
    )
      return new Response(
        JSON.stringify({
          error: "forbidden",
          message: "Same-origin transport required.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
  }
  let response = await (privateRequest ? timed('render', () => renderAsOperator(admitted, () => start.fetch(request))) : start.fetch(request));
  // Finish private rendering before the final native snapshot, including streamed SSR.
  if (admitted) response = new Response(await timed('body', () => response.arrayBuffer()), {status:response.status,statusText:response.statusText,headers:response.headers});
  if (admitted) {
    // Page resources now travel in the document. Retain the API's complete
    // native reauthorization (provider policy and restore grants included).
    const current = await timed('auth_end', () => requireOperator(env, request));
    if (!current || current.id !== admitted.id || JSON.stringify(current.fence) !== JSON.stringify(admitted.fence))
      return Response.json({error:'unauthenticated'}, {status:401, headers:{'Cache-Control':'no-store'}});
  }
  if (admitted && !(await timed('fence', () => operatorProjectionAdmitted(env.DB, admitted.id, workspace, admitted.fence)))) return Response.json({error:"unauthenticated"}, {status:401, headers:{"Cache-Control":"no-store"}});
  if (url.pathname.startsWith("/app") || url.pathname.startsWith("/_serverFn/"))
    response.headers.set("Cache-Control", "no-store");
  if (admitted) response.headers.append('Server-Timing', timings.join(', '));
  return response.headers.get("content-type")?.includes("text/html")?editorDocument(response,env):response;
}
const worker = withDemo({
  fetch: handleRequest,
  scheduled,
}, { seed: seedDemo });
export default {
  ...worker,
  async fetch(...args: Parameters<typeof worker.fetch>) {
    return encodePrivateDocument(args[0], await worker.fetch(...args));
  },
};
