import { createIntegrationReceivers } from '../features/integrations/receiver-routes';
import { createIntegrationApi } from '../features/integrations/api';
import { editorConfigResponse } from '../editor/config.server';
import { signedOwnerClaimConfigured,ownerClaimResponse } from '../features/auth/owner-claim.server';
import { developmentOutboxResponse } from '../features/auth/development.server';
import { establishRestoredOwner } from '../features/data/restore-authority';
import { BootstrapConfigurationError } from "../features/bootstrap/config";
import { bootstrapWorkspace } from "../features/bootstrap/repository";
import { RequestBodyError } from "./input";
import { isLocalOrigin } from "../features/auth/service";
import { ensureSampleData } from "../features/sample-data/service";
import { createAuthApp } from "../features/auth/routes";
import { Hono } from "hono";
import { createApiApp, healthResponse } from "./api";
import type { AppEnvironment } from "./bindings";

export type { WorkerBindings } from "./bindings";

export function createServerApp() {
  const app = new Hono<AppEnvironment>();
  app.onError((error, context) => {
    if (error instanceof RequestBodyError)
      return context.json(
        { error: "invalid_request", message: error.message },
        error.status,
      );
    console.error(error);
    return context.json(
      { error: "internal_error", message: "Unexpected server error." },
      500,
    );
  });
  app.use("*", async (context, next) => {
    if (!context.env.APP_ORIGIN)
      return context.json(
        { error: "configuration_missing", message: "APP_ORIGIN is required." },
        503,
      );
    if(context.req.path==='/auth/owner-claim')return ownerClaimResponse(context.env,context.req.raw);
    if (context.env.SEED_SAMPLE_DATA === "true") {
      if (!isLocalOrigin(context.env.APP_ORIGIN))
        return context.json(
          {
            error: "invalid_configuration",
            message:
              "Synthetic sample data is restricted to local development.",
          },
          503,
        );
      await ensureSampleData(context.env.DB, new Date());
    }
    if (
      context.env.SEED_SAMPLE_DATA !== "true" &&
      context.env.FIRST_OWNER_EMAIL &&
      (!signedOwnerClaimConfigured(context.env)||await context.env.DB.prepare("SELECT 1 FROM oa_operators LIMIT 1").first())
    ) {
      try {
        await bootstrapWorkspace(context.env.DB, context.env);
        if (context.req.path === '/health')
          await establishRestoredOwner(context.env.DB, context.env.FIRST_OWNER_EMAIL);
      } catch (error) {
        if (
          error instanceof BootstrapConfigurationError ||
          (error instanceof Error && error.name === "ZodError")
        )
          return context.json(
            {
              error: "configuration_missing",
              message:
                "Valid first-owner, workspace and default-team configuration is required.",
            },
            503,
          );
        throw error;
      }
    }
    await next();
  });

  app.get("/health", async (context) => {
    const health = await healthResponse(
      context.env.DB,
      context.env.SEED_SAMPLE_DATA === "true",
    );
    const { RER_DEPLOY_SOURCE, RER_DEPLOY_FINGERPRINT, RER_VERSION } = context.env;
    const deployment = RER_DEPLOY_SOURCE && RER_DEPLOY_FINGERPRINT && RER_VERSION?.id
      ? { sourceSha: RER_DEPLOY_SOURCE, fingerprint: RER_DEPLOY_FINGERPRINT, versionId: RER_VERSION.id }
      : null;
    return health
      ? context.json(deployment ? { ...health, ok: true, deployment } : health)
      : context.json(
          { status: "unavailable", message: "The DB binding is unavailable." },
          503,
        );
  });
  app.all("/__dev/outbox", async c => await developmentOutboxResponse(c.env, c.req.raw) ?? c.notFound());
  app.route("/auth", createAuthApp());
  app.all("/api/editor/config",async c=>editorConfigResponse(c.env,c.req.raw));
  app.route("/api/integrations",createIntegrationReceivers());
  app.route("/api/v1",createIntegrationApi());
  app.route("/api", createApiApp());

  return app;
}
