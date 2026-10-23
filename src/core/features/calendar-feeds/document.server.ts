import { env } from "cloudflare:workers";
import type { WorkerBindings } from "../../app/bindings";
import { requireOperator } from "../auth/service";
import { SettingsError } from "../settings/repository";
import { calendarAuthority } from "./service";
export async function admitCalendarDocument(request: Request) {
  const bindings = env as WorkerBindings, operator = await requireOperator(bindings, request, true);
  if (!operator) return new Response("Sign in to open Calendar.", { status: 401, headers: { "Cache-Control": "no-store" } });
  try { await calendarAuthority(bindings.DB, operator.id); }
  catch (error) {
    if (error instanceof SettingsError) return new Response(error.message, { status: error.status, headers: { "Cache-Control": "no-store" } });
    throw error;
  }
}
