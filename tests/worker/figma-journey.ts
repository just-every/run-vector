import { sha256 } from "../../vendor/base/integrations/core/crypto";
import { env } from "cloudflare:workers";
import assert from "node:assert/strict";
import { vi } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";
import { openSecret } from "../../src/core/features/integrations/secrets";

/** Public setup, OAuth, preview and personal-token capture with Figma wire shapes. */
export async function exerciseFigma() {
  const app = createServerApp(),
    origin = "https://vector.test",
    bindings = { ...env, APP_ORIGIN: origin };
  const owner = await testCookie(env.DB, ids.sarah),
    member = await testCookie(env.DB, ids.maya),
    other = await testCookie(env.DB, ids.alex);
  const req = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = owner,
    token?: string,
  ) =>
    app.request(
      origin + "/api" + path,
      {
        method,
        headers: {
          cookie,
          origin,
          "Content-Type": "application/json",
          "X-Vector-Load-Player": "true",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      bindings,
    );
  const json = async (response: Response, status = 200): Promise<any> => {
    const detail = (await response
      .clone()
      .json()
      .catch(() => null)) as any;
    assert.equal(
      response.status,
      status,
      JSON.stringify({ error: detail?.error, message: detail?.message }),
    );
    return response.json();
  };
  const role = async (kind: string) =>
    json(
      await req("/settings/operators/" + ids.maya + "/role", "PATCH", {
        role: kind,
        ...(kind === "guest" ? { teamIds: [ids.flow] } : {}),
      }),
    );
  const config = {
    clientId: "synthetic-vector-20301",
    clientSecret: "synthetic-vector-20302",
  };
  const linkUrl =
    "https://www.figma.com/design/synthetic20303/Fixture?node-id=1-2";
  const callLog: { path: string; bearer: string | null }[] = [];
  let mode = "success",
    expires = 3600,
    duringHost = "",
    during: (() => Promise<void>) | undefined;
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = new URL(String(input)),
        headers = new Headers(init?.headers);
      callLog.push({
        path: url.origin + url.pathname,
        bearer: headers.get("authorization"),
      });
      assert.equal(init?.redirect, "manual");
      assert.equal(init?.credentials, "omit");
      assert.equal(init?.referrerPolicy, "no-referrer");
      assert.equal(headers.has("cookie"), false);
      assert.equal(headers.has("origin"), false);
      if (during && (!duringHost || url.hostname === duringHost)) {
        const action = during;
        during = undefined;
        duringHost = "";
        await action();
      }
      if (mode === "redirect")
        return new Response(null, {
          status: 302,
          headers: { Location: "https://foreign.invalid/image" },
        });
      if (mode === "failure") return new Response(null, { status: 503 });
      if (mode === "large")
        return new Response(" ".repeat(65537), {
          headers: { "Content-Type": "application/json" },
        });
      if (mode === "html")
        return new Response("<script>bad()</script>", {
          headers: { "Content-Type": "text/html" },
        });
      if (url.pathname === "/v1/oauth/token") {
        assert.equal(url.origin, "https://api.figma.com");
        assert.equal(init?.method, "POST");
        // Figma authenticates the OAuth app with HTTP Basic, not body secrets.
        assert.equal(
          headers.get("authorization"),
          "Basic " + btoa(config.clientId + ":" + config.clientSecret),
        );
        assert.equal(
          headers.get("content-type"),
          "application/x-www-form-urlencoded",
        );
        const form = new URLSearchParams(String(init?.body));
        assert.deepEqual([...form.keys()].sort(), [
          "code",
          "grant_type",
          "redirect_uri",
        ]);
        assert.equal(
          form.get("redirect_uri"),
          origin + "/api/settings/figma/callback",
        );
        assert.equal(form.get("grant_type"), "authorization_code");
        const token =
          form.get("code") === "synthetic-vector-20304"
            ? "synthetic-vector-20305"
            : "synthetic-vector-20306";
        return Response.json({
          access_token: token,
          refresh_token: "synthetic-vector-20307",
          expires_in: expires,
          token_type: "bearer",
        });
      }
      assert.equal(init?.method ?? "GET", "GET");
      assert.equal(init?.body, undefined);
      if (url.hostname === "s3-alpha-sig.figma.com") {
        assert.equal(headers.get("authorization"), null);
        assert.equal(url.pathname, "/img/synthetic20308/fixture");
        if (mode === "image-large")
          return new Response(png, {
            headers: {
              "Content-Type": "image/png",
              "Content-Length": String(4 * 1024 * 1024 + 1),
            },
          });
        if (mode === "bad-png")
          return new Response(new Uint8Array([0]), {
            headers: { "Content-Type": "image/png" },
          });
        return new Response(png, { headers: { "Content-Type": "image/png" } });
      }
      assert.equal(url.origin, "https://api.figma.com");
      assert.ok(
        [
          "Bearer synthetic-vector-20305",
          "Bearer synthetic-vector-20306",
        ].includes(headers.get("authorization") ?? ""),
      );
      assert.equal(url.searchParams.get("ids"), "1:2");
      if (url.pathname.endsWith("/nodes")) {
        assert.equal(url.pathname, "/v1/files/synthetic20303/nodes");
        assert.equal(url.searchParams.get("depth"), "1");
        return Response.json({
          name: "synthetic-vector-20309",
          lastModified: "2026-11-01T12:00:00Z",
          nodes: {
            "1:2": {
              document: {
                id: "1:2",
                name: "synthetic-vector-20310",
                type: "FRAME",
              },
            },
          },
        });
      }
      assert.equal(url.pathname, "/v1/images/synthetic20303");
      assert.equal(url.searchParams.get("format"), "png");
      assert.equal(url.searchParams.get("scale"), "1");
      return Response.json({
        err: null,
        images: {
          "1:2":
            mode === "foreign"
              ? "https://foreign.invalid/image"
              : "https://s3-alpha-sig.figma.com/img/synthetic20308/fixture?synthetic=20311",
        },
      });
    });
  const begin = async (cookie = member) => {
    const result = new URL(
      (await json(await req("/settings/figma/connect", "POST", {}, cookie)))
        .url,
    );
    assert.equal(
      result.origin + result.pathname,
      "https://www.figma.com/oauth",
    );
    assert.equal(result.searchParams.get("scope"), "file_content:read");
    assert.equal(
      result.searchParams.get("redirect_uri"),
      origin + "/api/settings/figma/callback",
    );
    return result.searchParams.get("state")!;
  };
  const callback = (
    state: string,
    cookie = member,
    code = "synthetic-vector-20304",
  ) =>
    req(
      "/settings/figma/callback?" + new URLSearchParams({ state, code }),
      "GET",
      undefined,
      cookie,
    );
  const connect = async (cookie = member, code = "synthetic-vector-20304") => {
    const response = await callback(await begin(cookie), cookie, code);
    assert.equal(response.status, 303, await response.clone().text());
    assert.equal(
      response.headers.get("location"),
      "/app/settings/account?figma=connected",
    );
  };
  const snapshot = async () =>
    sha256(
      JSON.stringify(
        await Promise.all(
          [
            "issues",
            "issue_links",
            "issue_activity",
            "vector_figma_captures",
            "vector_figma_installations",
            "vector_integration_secret_keys",
          ].map(
            async (table) =>
              (
                await env.DB.prepare(
                  "SELECT * FROM " + table + " ORDER BY 1",
                ).all()
              ).results,
          ),
        ),
      ),
    );
  try {
    await role("member");
    const beforeSetup = await snapshot();
    await json(
      await req("/settings/integrations/figma", "POST", config, member),
      403,
    );
    assert.equal(await snapshot(), beforeSetup);
    await json(await req("/settings/integrations/figma", "POST", config));
    const publicConfig = await json(await req("/settings/integrations/figma"));
    assert.equal(
      publicConfig.callback,
      origin + "/api/settings/figma/callback",
    );
    assert.equal(
      JSON.stringify(publicConfig).includes(config.clientSecret),
      false,
    );
    await json(
      await req("/settings/integrations/figma", "POST", {
        ...config,
        callback: "https://foreign.invalid",
      }),
      400,
    );
    await role("admin");
    await json(
      await req("/settings/integrations/figma", "POST", config, member),
    );
    await role("member");
    const manifest = await json(
      await req("/settings/figma/manifest", "GET", undefined, member),
    );
    assert.deepEqual(manifest.networkAccess.allowedDomains, [origin]);
    const issue = await json(
      await req("/issues", "POST", {
        title: "synthetic-vector-20312",
        teamId: ids.flow,
      }),
      201,
    );
    const base = "/issues/" + issue.identifier;
    const attach = async (url: string) =>
      json(
        await req(base + "/links", "POST", {
          name: "synthetic-vector-20313",
          url,
        }),
        201,
      );
    const link = await attach(linkUrl),
      previewPath = base + "/links/" + link.id + "/figma-preview",
      imagePath = base + "/links/" + link.id + "/figma-image";
    const preview = (cookie = member) =>
      req(previewPath, "GET", undefined, cookie);
    const noAccount = callLog.length;
    assert.deepEqual(await json(await preview()), {
      preview: null,
      connected: false,
    });
    assert.equal(callLog.length, noAccount);
    const state = await begin();
    const noExchange = callLog.length;
    await json(await callback("0".repeat(72)), 403);
    await json(await callback(state, other), 403);
    await json(await callback(state, await testCookie(env.DB, ids.maya)), 403);
    assert.equal(callLog.length, noExchange);
    assert.equal((await callback(state)).status, 303);
    await json(await callback(state), 403);
    assert.equal(callLog.length, noExchange + 1);
    const meta = await json(await preview());
    assert.equal(meta.preview.title, "synthetic-vector-20310");
    assert.equal(meta.preview.lastModified, "2026-11-01T12:00:00Z");
    assert.equal(meta.preview.imageUrl, "/api" + imagePath);
    assert.equal(JSON.stringify(meta).includes("s3-alpha"), false);
    const image = await req(imagePath, "GET", undefined, member);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("cache-control"), "no-store");
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
    const ownCalls = callLog.length;
    assert.deepEqual(
      await json(await req(previewPath, "GET", undefined, owner)),
      { preview: null, connected: false },
    );
    assert.equal(callLog.length, ownCalls);
    await connect(owner, "synthetic-vector-20314");
    await json(await req(previewPath));
    assert.equal(callLog.at(-1)!.bearer, "Bearer synthetic-vector-20306");
    await json(await preview());
    assert.equal(callLog.at(-1)!.bearer, "Bearer synthetic-vector-20305");
    for (const failure of ["redirect", "failure", "large", "html"]) {
      mode = failure;
      const count = callLog.length;
      await json(await preview(), 502);
      assert.equal(callLog.length, count + 1);
    }
    mode = "foreign";
    const beforeForeign = callLog.length;
    await json(await req(imagePath, "GET", undefined, member), 502);
    assert.equal(callLog.length, beforeForeign + 1);
    for (const failure of ["image-large", "bad-png"]) {
      mode = failure;
      await json(await req(imagePath, "GET", undefined, member), 502);
    }
    mode = "success";
    duringHost = "s3-alpha-sig.figma.com";
    during = async () => {
      await json(await req("/settings/figma", "DELETE", undefined, member));
    };
    await json(await req(imagePath, "GET", undefined, member), 404);
    await connect();
    for (const url of [
      "https://www.figma.com.evil.invalid/design/synthetic20303?node-id=1-2",
      "https://www.figma.com:8443/design/synthetic20303?node-id=1-2",
      "https://www.figma.com/design/synthetic20303?node-id=bad",
      "https://www.figma.com/design/synthetic20303?next=https://foreign.invalid",
    ]) {
      const bad = await attach(url),
        calls = callLog.length;
      await json(
        await req(
          base + "/links/" + bad.id + "/figma-preview",
          "GET",
          undefined,
          member,
        ),
        422,
      );
      assert.equal(callLog.length, calls);
    }
    const calls = callLog.length;
    await json(
      await app.request(
        origin + "/api" + previewPath,
        { headers: { cookie: member, origin } },
        bindings,
      ),
      403,
    );
    await json(await preview(""), 401);
    assert.equal(callLog.length, calls);
    for (const kind of ["guest", "viewer"]) {
      await role(kind);
      const noRead = callLog.length;
      await json(await req("/settings/figma/connect", "POST", {}, member), 403);
      assert.deepEqual(await json(await preview()), {
        preview: null,
        connected: false,
      });
      assert.equal(callLog.length, noRead);
    }
    await role("member");
    const team = (
      await json(
        await req("/settings/teams", "POST", {
          name: "synthetic-vector-20315",
          identifierPrefix: "FIGPRV",
        }),
      )
    ).teams.find((t: any) => t.identifierPrefix === "FIGPRV");
    const privateIssue = await json(
      await req("/issues", "POST", {
        title: "synthetic-vector-20316",
        teamId: team.id,
      }),
      201,
    );
    const privateLink = await json(
      await req("/issues/" + privateIssue.identifier + "/links", "POST", {
        name: "synthetic-vector-20317",
        url: linkUrl,
      }),
      201,
    );
    const privatePath =
      "/issues/" +
      privateIssue.identifier +
      "/links/" +
      privateLink.id +
      "/figma-preview";
    await json(
      await req("/settings/teams/" + team.id + "/privacy", "PUT", {
        isPrivate: true,
      }),
    );
    const privateCount = callLog.length;
    await json(await req(privatePath, "GET", undefined, member), 404);
    assert.equal(callLog.length, privateCount);
    await json(
      await req("/settings/teams/" + team.id + "/members/" + ids.maya, "PUT", {
        role: "member",
      }),
    );
    during = async () => {
      await json(
        await req(
          "/settings/teams/" + team.id + "/members/" + ids.maya,
          "DELETE",
        ),
      );
    };
    await json(await req(privatePath, "GET", undefined, member), 404);
    await json(await req("/settings/figma", "DELETE", undefined, member));
    const disconnected = callLog.length;
    assert.equal((await json(await preview())).preview, null);
    assert.equal(callLog.length, disconnected);
    const expiredState = await begin();
    await env.DB.prepare(
      "UPDATE vector_integration_secret_keys SET valid_until=1 WHERE identity LIKE 'figma-state:%'",
    ).run();
    await json(await callback(expiredState), 403);
    assert.equal(callLog.length, disconnected);
    const pending = await begin();
    during = async () => {
      await json(await req("/settings/figma", "DELETE", undefined, member));
    };
    await json(await callback(pending), 503);
    assert.equal(
      (await json(await req("/settings/figma", "GET", undefined, member)))
        .connected,
      false,
    );
    expires = 1;
    await connect();
    expires = 3600;
    const nativeNow = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(nativeNow + 2000);
    try {
      const count = callLog.length;
      assert.equal((await json(await preview())).preview, null);
      assert.equal(callLog.length, count);
      assert.equal(
        (await json(await req("/settings/figma", "GET", undefined, member)))
          .needsAttention,
        true,
      );
    } finally {
      clock.mockRestore();
    }
    await connect();
    const sealed = (
      await env.DB.prepare(
        "SELECT identity,encrypted FROM vector_integration_secret_keys WHERE identity LIKE 'figma%'",
      ).all<{ identity: string; encrypted: string }>()
    ).results;
    assert.ok(sealed.length >= 3);
    assert.ok(
      sealed.every((row) => !row.encrypted.includes("synthetic-vector-")),
    );
    for (const row of sealed.filter((row) =>
      row.identity.startsWith("figma-member:"),
    ))
      assert.ok(
        (await openSecret(bindings, row.identity, row.encrypted)).includes(
          "synthetic-vector-",
        ),
      );
    const token = await json(
      await req(
        "/settings/integrations/tokens",
        "POST",
        { name: "synthetic-vector-20318", scopes: ["issues:write"] },
        member,
      ),
      201,
    );
    const capture = {
      captureId: "synthetic-vector-20319",
      title: "synthetic-vector-20320",
      teamId: ids.flow,
      figmaUrl: linkUrl,
    };
    const plugin = (body = capture, credential = token.token) =>
      req("/v1/integrations/figma/issues", "POST", body, "", credential);
    const preflight = await app.request(
      origin + "/api/v1/integrations/figma/issues",
      {
        method: "OPTIONS",
        headers: {
          Origin: "null",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization, content-type",
        },
      },
      bindings,
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "null");
    assert.equal(
      preflight.headers.has("access-control-allow-credentials"),
      false,
    );
    const fromPlugin = (
      originHeader: string,
      credential: string,
      body: unknown = capture,
    ) =>
      app.request(
        origin + "/api/v1/integrations/figma/issues",
        {
          method: "POST",
          headers: {
            Origin: originHeader,
            Authorization: "Bearer " + credential,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        bindings,
      );
    const foreignBefore = await snapshot();
    await json(await fromPlugin("https://foreign.invalid", token.token), 403);
    assert.equal(await snapshot(), foreignBefore);
    const first = await fromPlugin("null", token.token);
    assert.equal(first.headers.get("access-control-allow-origin"), "null");
    const created = await json(first, 201);
    assert.equal((await json(await plugin())).identifier, created.identifier);
    assert.equal((await json(await plugin())).replay, true);
    const storedLinks = await json(
      await req(
        "/issues/" + created.identifier + "/links",
        "GET",
        undefined,
        member,
      ),
    );
    assert.equal(storedLinks.links.length, 1);
    assert.equal(
      storedLinks.links[0].url,
      "https://www.figma.com/design/synthetic20303?node-id=1-2",
    );
    const snapshotBefore = await snapshot();
    await json(
      await plugin({ ...capture, title: "synthetic-vector-20321" }),
      409,
    );
    assert.equal(await snapshot(), snapshotBefore);
    const readToken = await json(
      await req(
        "/settings/integrations/tokens",
        "POST",
        { name: "synthetic-vector-20322", scopes: ["issues:read"] },
        member,
      ),
      201,
    );
    await json(await plugin(capture, readToken.token), 401);
    assert.equal(await snapshot(), snapshotBefore);
    await json(
      await req(
        "/settings/integrations/tokens/" + token.credential.id,
        "DELETE",
        undefined,
        member,
      ),
    );
    await json(await plugin(), 401);
    assert.equal(await snapshot(), snapshotBefore);
    const freshToken = await json(
      await req(
        "/settings/integrations/tokens",
        "POST",
        { name: "synthetic-vector-20323", scopes: ["issues:write"] },
        member,
      ),
      201,
    );
    await json(
      await plugin(
        { ...capture, captureId: "synthetic-vector-20324", teamId: team.id },
        freshToken.token,
      ),
      404,
    );
    assert.equal(await snapshot(), snapshotBefore);
    await role("viewer");
    await json(
      await plugin(
        { ...capture, captureId: "synthetic-vector-20325" },
        freshToken.token,
      ),
      403,
    );
    assert.equal(await snapshot(), snapshotBefore);
    await role("member");
    await role("guest");
    const guestCapture = { ...capture, captureId: "synthetic-vector-20327" };
    await json(await plugin(guestCapture, freshToken.token), 201);
    const guestBefore = await snapshot();
    await json(
      await plugin(
        {
          ...guestCapture,
          captureId: "synthetic-vector-20328",
          teamId: ids.platform,
        },
        freshToken.token,
      ),
      404,
    );
    assert.equal(await snapshot(), guestBefore);
    await role("member");
    const oauthApp = await json(
      await req("/settings/oauth-apps", "POST", {
        name: "synthetic-vector-20329",
        redirectUris: ["https://synthetic-vector-20330.invalid/callback"],
        scopes: ["issues:write"],
      }),
      201,
    );
    const oauthRequest = {
      response_type: "code",
      client_id: oauthApp.id,
      redirect_uri: "https://synthetic-vector-20330.invalid/callback",
      scope: "issues:write",
      state: "synthetic-vector-20331",
    };
    const consent = await json(
      await req(
        "/oauth/consent",
        "POST",
        { request: oauthRequest, decision: "approve" },
        member,
      ),
    );
    const oauth = await json(
      await req("/oauth/token", "POST", {
        grant_type: "authorization_code",
        client_id: oauthApp.id,
        client_secret: oauthApp.secret,
        code: new URL(consent.redirect).searchParams.get("code"),
        redirect_uri: oauthRequest.redirect_uri,
      }),
    );
    const consentBefore = await snapshot();
    await json(await fromPlugin("null", oauth.access_token), 403);
    assert.equal(await snapshot(), consentBefore);
    const next = { ...capture, captureId: "synthetic-vector-20326" };
    const duplicates = await Promise.all([
      plugin(next, freshToken.token),
      plugin(next, freshToken.token),
    ]);
    assert.deepEqual(duplicates.map((row) => row.status).sort(), [200, 201]);
    const concurrent = await Promise.all(
      duplicates.map((row) => row.json() as Promise<any>),
    );
    assert.equal(concurrent[0].identifier, concurrent[1].identifier);
    // A permanent native deletion retires the capture receipt, so replay cannot resurrect it.
    assert.equal(
      (
        await req("/issues/" + created.identifier, "DELETE", {
          expectedVersion: 1,
          confirmed: true,
        })
      ).status,
      200,
    );
    const deletedBefore = await snapshot();
    await json(await plugin(capture, freshToken.token), 409);
    assert.equal(await snapshot(), deletedBefore);
    const pendingRemoval = await begin(other);
    during = async () => {
      await json(await req("/settings/operators/" + ids.alex, "DELETE"));
    };
    await json(await callback(pendingRemoval, other), 401);
    assert.equal(
      await env.DB.prepare(
        "SELECT count(*) n FROM vector_integration_secret_keys WHERE identity LIKE ?",
      )
        .bind("figma-member:%:" + ids.alex)
        .first("n"),
      0,
    );
    // A stored grant cannot outlive removal, even when a provider response was in flight.
    assert.equal((await req(previewPath, "GET", undefined, other)).status, 401);
    const rotatedState = await begin(member),
      beforeRotation = callLog.length;
    await json(await req("/settings/integrations/figma", "POST", config));
    await json(await callback(rotatedState), 403);
    assert.equal(callLog.length, beforeRotation);
    assert.equal((await json(await preview())).preview, null);
    assert.equal(callLog.length, beforeRotation);
    await json(await req("/settings/integrations/figma", "DELETE"));
    const stopped = callLog.length;
    assert.equal((await json(await preview())).preview, null);
    assert.equal(callLog.length, stopped);
    await json(await req("/settings/integrations/figma", "POST", config));
    await connect(owner, "synthetic-vector-20314");
    const ownerToken = await json(
      await req("/settings/integrations/tokens", "POST", {
        name: "synthetic-vector-20332",
        scopes: ["issues:write"],
      }),
      201,
    );
    const ownerCapture = { ...capture, captureId: "synthetic-vector-20333" };
    const ownerCreated = await json(
      await plugin(ownerCapture, ownerToken.token),
      201,
    );
    await begin(member);
    return {
      req,
      owner,
      config,
      ownerCapture,
      ownerIdentifier: ownerCreated.identifier,
      secrets: [
        config.clientSecret,
        "synthetic-vector-20305",
        "synthetic-vector-20306",
        "synthetic-vector-20307",
      ],
    };
  } finally {
    network.mockRestore();
  }
}
