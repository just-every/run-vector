import { returnDueIntake } from "../features/intake-return/service";
import { processFileRemovals } from "../features/file-removal/service";
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
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/favicon.svg" ||
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
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
    if (!(await requireOperator(env, request))) {
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
  const response = await start.fetch(request);
  if (url.pathname.startsWith("/app") || url.pathname.startsWith("/_serverFn/"))
    response.headers.set("Cache-Control", "no-store");
  return response;
}
export default {
  fetch: handleRequest,
  async scheduled(_event: ScheduledController, env: WorkerBindings) {
    await Promise.all([processFileRemovals(env), returnDueIntake(env)]);
  },
};
