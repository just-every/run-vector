import {addGithubIssueProjection} from '../features/integrations/github/issue-projection';
import {createReleaseApi} from '../features/releases/api';
import { dependencyResponse, isDependencyPath } from '../features/auth/dependencies.server';
import { createIntegrationReceivers } from '../features/integrations/receiver-routes';
import { createIntegrationApi } from '../features/integrations/api';
import { editorConfigResponse } from '../editor/config.server';
import { signedOwnerClaimConfigured,ownerClaimResponse } from '../features/auth/owner-claim.server';
import { bootstrapOwnerResponse } from '../features/auth/bootstrap.server';
import { developmentKeyResponse } from '../features/auth/development.server';
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
import { lobbyResponse } from '../../base/lobby';
import { claimedWhen, setupStateResponse } from '../../base/setup-state';
import { identity } from './identity';

const claimed = claimedWhen('SELECT 1 FROM oa_bootstrap WHERE singleton = 1');

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
    const lobbyBindings = { DB: context.env.DB, AUTH_ORIGIN: context.env.APP_ORIGIN };
    const state = await setupStateResponse(context.req.raw, lobbyBindings, claimed);
    if (state) return state;
    if (context.req.path === '/') {
      let isClaimed: boolean;
      // Configured-owner installs have no setup token to ask for, even before
      // the first request initializes their owner. Signed claims stay explicit.
      try { isClaimed = await claimed(context.env.DB) || Boolean(context.env.FIRST_OWNER_EMAIL && !context.env.SETUP_TOKEN && !signedOwnerClaimConfigured(context.env)); }
      catch { return context.json({ error: 'setup_unavailable' }, 503, { 'Cache-Control': 'no-store' }); }
      const workspaceName = context.env.WORKSPACE_NAME?.trim();
      if (isClaimed && !workspaceName) return context.json({ error: 'configuration_missing', message: 'WORKSPACE_NAME is required.' }, 503, { 'Cache-Control': 'no-store' });
      // Use one admission snapshot for both the state and installation name.
      const lobby = await lobbyResponse(context.req.raw, lobbyBindings, { ...identity, deployment: workspaceName || identity.product }, async () => isClaimed);
      if (lobby) return lobby;
    }
    if (isDependencyPath(context.req.path)) return await dependencyResponse(context.env, context.req.raw) ?? context.notFound();
    if(context.req.path==='/auth/owner-claim')return ownerClaimResponse(context.env,context.req.raw);
    if(context.req.path==='/auth/bootstrap')return bootstrapOwnerResponse(context.env,context.req.raw);
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
      ((!signedOwnerClaimConfigured(context.env) && !context.env.SETUP_TOKEN)||await context.env.DB.prepare("SELECT 1 FROM oa_operators LIMIT 1").first())
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
  app.all("/__dev/key", async c => await developmentKeyResponse(c.env, c.req.raw) ?? c.notFound());
  app.route("/auth", createAuthApp());
  app.all("/api/editor/config",async c=>editorConfigResponse(c.env,c.req.raw));
  app.route("/api/integrations",createIntegrationReceivers());
  addGithubIssueProjection(app,true);
  app.route("/api/v1",createReleaseApi());
  app.route("/api/v1",createIntegrationApi());
  app.route("/api", createApiApp());

  return app;
}
