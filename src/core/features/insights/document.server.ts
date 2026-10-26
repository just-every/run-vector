import { env } from "cloudflare:workers";
import type { WorkerBindings } from "../../app/bindings";
import { requestBindings } from "../../app/request-bindings.server";
import { requireOperator } from "../auth/service";
import { SettingsError } from "../settings/repository";
import { insightAuthority } from "./read";
export async function admitInsightDocument(request: Request) {
  const bindings = requestBindings(env as WorkerBindings);
  const operator = await requireOperator(bindings, request, true);
  if (!operator) return new Response("Sign in to open Insights.", { status: 401, headers: { "Cache-Control": "no-store" } });
  try { await insightAuthority(bindings.DB, operator.id); }
  catch (error) {
    if (error instanceof SettingsError) return new Response(error.message, { status: error.status, headers: { "Cache-Control": "no-store" } });
    throw error;
  }
}
