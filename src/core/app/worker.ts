import { scheduled } from './scheduled';
export { VectorRestoreCoordinator } from '../features/data/restore-coordinator';
import { editorDocument } from '../editor/config.server';
import { operatorProjectionAdmitted } from '../features/auth/projection-admission';
import { developmentOutboxResponse } from '../features/auth/development.server';
import { requireOperator, safeReturnTo } from "../features/auth/service";
import start from "@tanstack/react-start/server-entry";
import { createServerApp, type WorkerBindings } from "./server";
import { isViteDevelopmentAsset } from "./vite-development-path";
const app = createServerApp();
export async function handleRequest(
  request: Request,
  env: WorkerBindings,
): Promise<Response> {
  const url = new URL(request.url);
  if (env.APP_ORIGIN && url.host !== new URL(env.APP_ORIGIN).host)
    return new Response("Not found", { status: 404 });
  if (url.pathname === '/__dev/outbox' || url.pathname === '/__dev/key') return await developmentOutboxResponse(env, request) ?? new Response('Not found', {status:404});
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
    url.pathname === "/health" ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  )
    return app.fetch(request, env);
  const privateRequest = url.pathname === "/app" || url.pathname.startsWith("/app/") || url.pathname.startsWith("/_serverFn/");
  const admitted = privateRequest ? await requireOperator(env, request) : null;
  const workspace = admitted ? await env.DB.prepare("SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL").bind(admitted.id).first<string>("workspace_id") : null;
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
  let response = await start.fetch(request);
  // Finish private rendering before the final native snapshot, including streamed SSR.
  if (admitted) response = new Response(await response.arrayBuffer(), {status:response.status,statusText:response.statusText,headers:response.headers});
  if (admitted && !(await operatorProjectionAdmitted(env.DB, admitted.id, workspace, admitted.fence))) return Response.json({error:"unauthenticated"}, {status:401, headers:{"Cache-Control":"no-store"}});
  if (url.pathname.startsWith("/app") || url.pathname.startsWith("/_serverFn/"))
    response.headers.set("Cache-Control", "no-store");
  return response.headers.get("content-type")?.includes("text/html")?editorDocument(response,env):response;
}
export default {
  fetch: handleRequest,
  scheduled,
};
