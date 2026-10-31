import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnvironment } from "../../app/bindings";
import { requireOperator } from "../auth/service";
import { IssueAccessError, requireIssueAccess } from "../issues/access";
import { issueIdentifier, linkId } from "./schema";
import { namedVideoSource } from "./repository";
import { publicVideo } from "./public-video";
import { videoPreview } from "./video-preview";

export function addVideoPreviewRoute(app: Hono<AppEnvironment>) {
  app.get("/issues/:identifier/links/:linkId/preview", async (c) => {
    if (
      !z
        .object({ identifier: issueIdentifier, linkId })
        .strict()
        .safeParse(c.req.param()).success ||
      Object.keys(c.req.query()).length
    )
      return c.json({ error: "invalid_request" }, 400);
    // A custom same-origin fetch header excludes navigations and passive embeds.
    if (
      c.req.header("X-Vector-Load-Player") !== "true" ||
      (c.req.header("Origin") && c.req.header("Origin") !== c.env.APP_ORIGIN)
    )
      return c.json({ error: "explicit_load_required" }, 403);
    const current = async () => {
      const actor = await requireOperator(c.env, c.req.raw);
      if (!actor || actor.id !== c.get("operatorId")) return null;
      try {
        const issue = await requireIssueAccess(
          c.env.DB,
          c.req.param("identifier"),
          actor.id,
        );
        return namedVideoSource(c.env.DB, issue.id, c.req.param("linkId"));
      } catch (error) {
        if (error instanceof IssueAccessError) return null;
        throw error;
      }
    };
    const link = await current();
    if (!link) return c.json({ error: "not_found" }, 404);
    const video = publicVideo(link.url);
    if (!video)
      return c.json(
        {
          error: "unsupported_video",
          message: "Use a public Loom or YouTube video link.",
        },
        422,
      );
    let preview;
    try {
      preview = await videoPreview(video);
    } catch {
      return c.json(
        {
          error: "provider_unavailable",
          message:
            "The video provider could not load this player. Try again or open the original link.",
        },
        502,
      );
    }
    // Do not expose a fetched DTO after session, visibility or link withdrawal.
    const retained = await current();
    if (!retained || retained.url !== link.url)
      return c.json({ error: "not_found" }, 404);
    return c.json({ preview });
  });
}
