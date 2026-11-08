import { z } from "zod";
import type { WorkerBindings } from "../../../app/bindings";
import {
  integrationOwner,
  guardedSql,
  ownerPredicate,
  type IntegrationOwner,
} from "../authority";
import { IntegrationError } from "../errors";
import { sealSecret, openSecret } from "../secrets";
import { auditStatement } from "../../audit/producer";
import { figmaCallback, pluginManifest } from "./urls";

export const appInput = z
  .object({
    clientId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9._-]+$/),
    clientSecret: z
      .string()
      .min(10)
      .max(1000)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  })
  .strict();
export const appKey = (workspace: string) => "figma-app:" + workspace;
export const memberKey = (owner: IntegrationOwner) =>
  "figma-member:" + owner.workspace + ":" + owner.id;
export const statePrefix = (owner: IntegrationOwner) =>
  "figma-state:" + owner.workspace + ":" + owner.id + ":";
export async function figmaManager(env: WorkerBindings, request: Request) {
  const owner = await integrationOwner(env, request);
  const role = await env.DB.prepare(
    "SELECT role FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL",
  )
    .bind(owner.id, owner.workspace)
    .first<string>("role");
  if (!["owner", "admin"].includes(role ?? ""))
    throw new IntegrationError(403, "forbidden");
  return owner;
}
export function figmaSql(
  env: WorkerBindings,
  owner: IntegrationOwner,
  manage: boolean | "personal" = false,
) {
  const predicate = ownerPredicate(owner);
  return guardedSql(env.DB, {
    sql:
      "(" +
      predicate.sql +
      ")" +
      (manage
        ? " AND EXISTS(SELECT 1 FROM operators WHERE id=? AND role IN (" +
          (manage === "personal"
            ? "'owner','admin','member'"
            : "'owner','admin'") +
          ") AND removed_at IS NULL)"
        : ""),
    params: [...(predicate.params ?? []), ...(manage ? [owner.id] : [])],
  });
}
export async function secretRow(env: WorkerBindings, key: string) {
  return env.DB.prepare(
    "SELECT encrypted,valid_until AS expires FROM vector_integration_secret_keys WHERE identity=? AND slot='current'",
  )
    .bind(key)
    .first<{ encrypted: string; expires: number | null }>();
}
export async function readFigmaApp(
  env: WorkerBindings,
  owner: IntegrationOwner,
) {
  const present = await secretRow(env, appKey(owner.workspace));
  const configured = await env.DB.prepare(
    "SELECT 1 FROM vector_figma_installations WHERE workspace_id=?",
  )
    .bind(owner.workspace)
    .first();
  return {
    configured: Boolean(configured),
    requiresReentry: Boolean(configured && !present),
    callback: figmaCallback(env.APP_ORIGIN),
    scopes: ["file_content:read"],
    manifest: pluginManifest(env.APP_ORIGIN),
  };
}
export async function saveFigmaApp(
  env: WorkerBindings,
  owner: IntegrationOwner,
  input: unknown,
) {
  const parsed = appInput.safeParse(input);
  if (!parsed.success)
    throw new IntegrationError(400, "figma_app_credentials_invalid");
  const key = appKey(owner.workspace),
    encrypted = await sealSecret(env, key, JSON.stringify(parsed.data));
  await figmaSql(env, owner, true).batch([
    {
      sql: "DELETE FROM vector_integration_secret_keys WHERE identity LIKE ? OR identity LIKE ?",
      params: [
        "figma-member:" + owner.workspace + ":%",
        "figma-state:" + owner.workspace + ":%",
      ],
    },
    {
      sql: "INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",
      params: [key, encrypted],
    },
    {
      sql: "INSERT INTO vector_figma_installations(workspace_id,configured_at) VALUES(?,?) ON CONFLICT(workspace_id) DO UPDATE SET configured_at=excluded.configured_at",
      params: [owner.workspace, new Date().toISOString()],
    },
    auditStatement({
      workspace: owner.workspace,
      actor: owner.id,
      action: "figma.app_configured",
      subject: owner.workspace,
    }),
  ]);
  return { saved: true };
}
export async function removeFigmaApp(
  env: WorkerBindings,
  owner: IntegrationOwner,
) {
  await figmaSql(env, owner, true).batch([
    {
      sql: "DELETE FROM vector_integration_secret_keys WHERE identity=? OR identity LIKE ? OR identity LIKE ?",
      params: [
        appKey(owner.workspace),
        "figma-member:" + owner.workspace + ":%",
        "figma-state:" + owner.workspace + ":%",
      ],
    },
    {
      sql: "DELETE FROM vector_figma_installations WHERE workspace_id=?",
      params: [owner.workspace],
    },
    auditStatement({
      workspace: owner.workspace,
      actor: owner.id,
      action: "figma.app_removed",
      subject: owner.workspace,
    }),
  ]);
  return {
    removed: true,
    providerAction:
      "Remove this OAuth app or revoke its grants in Figma if they are no longer needed.",
  };
}
export async function loadApp(env: WorkerBindings, owner: IntegrationOwner) {
  const row = await secretRow(env, appKey(owner.workspace));
  if (!row)
    throw new IntegrationError(
      409,
      "figma_app_reentry_required",
      "An Owner or Admin must enter the Figma app credentials in Settings.",
    );
  return {
    ...row,
    profile: appInput.parse(
      JSON.parse(await openSecret(env, appKey(owner.workspace), row.encrypted)),
    ),
  };
}
