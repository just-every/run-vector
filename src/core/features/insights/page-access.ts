import { createServerFn } from "@tanstack/react-start";
/** The page and its data read independently check the current actor. */
export const requireInsightsPage = createServerFn({ method: "GET" }).handler(async () => {
  const { currentOperator } = await import("../../app/request.server");
  const { env } = await import("cloudflare:workers");
  const { insightAuthority } = await import("./read");
  const operator = await currentOperator();
  if (!operator) throw new Response("Sign in to open Insights.", { status: 401 });
  try { await insightAuthority(env.DB, operator.id); }
  catch (error) {
    const { SettingsError } = await import("../settings/repository");
    if (error instanceof SettingsError) throw new Response(error.message, { status: error.status });
    throw error;
  }
});
