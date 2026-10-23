import { createServerFn } from "@tanstack/react-start";
export const requireCalendarPage = createServerFn({ method: "GET" }).handler(async () => {
  const { currentOperator } = await import("../../app/request.server");
  const { env } = await import("cloudflare:workers");
  const { calendarAuthority } = await import("./service");
  const operator = await currentOperator();
  if (!operator) throw new Response("Sign in to open Calendar.", { status: 401 });
  try { await calendarAuthority(env.DB, operator.id); }
  catch (error) {
    const { SettingsError } = await import("../settings/repository");
    if (error instanceof SettingsError) throw new Response(error.message, { status: error.status });
    throw error;
  }
});
