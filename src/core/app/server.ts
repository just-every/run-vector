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
      context.env.FIRST_OWNER_EMAIL
    ) {
      try {
        await bootstrapWorkspace(context.env.DB, context.env);
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
  app.route("/auth", createAuthApp());
  app.route("/api", createApiApp());

  return app;
}
