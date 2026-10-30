import { env } from "cloudflare:workers";
import assert from "node:assert/strict";
import { vi } from "vitest";
import { createServerApp } from "../../src/core/app/server";
import { vectorSampleIds as ids } from "../../sample-data/vector";
import { testCookie } from "./native-fixture";

/** Named-link lifecycle through the protected API, with real oEmbed wire shapes. */
export async function exerciseVideoPreviews() {
  const app = createServerApp(),
    origin = "https://vector.test";
  const owner = await testCookie(env.DB, ids.sarah),
    member = await testCookie(env.DB, ids.maya);
  const req = (path: string, method = "GET", body?: unknown, cookie = owner) =>
    app.request(
      origin + "/api" + path,
      {
        method,
        headers: {
          cookie,
          origin,
          "Content-Type": "application/json",
          "X-Vector-Load-Player": "true",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      { ...env, APP_ORIGIN: origin },
    );
  const json = async (response: Response, status = 200): Promise<any> => {
    assert.equal(response.status, status, await response.clone().text());
    return response.json();
  };
  await json(
    await req(`/settings/operators/${ids.maya}/role`, "PATCH", {
      role: "member",
    }),
  );
  const team = (
    await json(
      await req("/settings/teams", "POST", {
        name: "synthetic-vector-11501",
        identifierPrefix: "VIDPRV",
      }),
    )
  ).teams.find((t: any) => t.identifierPrefix === "VIDPRV");
  const issue = await json(
    await req("/issues", "POST", {
      title: "synthetic-vector-11502",
      description: "synthetic-vector-11503 private body",
      teamId: team.id,
    }),
    201,
  );
  const base = "/issues/" + issue.identifier;
  const attach = async (url: string, commentId?: string) =>
    json(
      await req(base + "/links", "POST", {
        name: "synthetic-vector-11504",
        url,
        ...(commentId ? { commentId } : {}),
      }),
      201,
    );
  const load = (id: string, cookie = member) =>
    req(base + "/links/" + id + "/preview", "GET", undefined, cookie);
  const loom = "https://www.loom.com/share/1234567890abcdef1234567890abcdef",
    youtube = "https://www.youtube.com/watch?v=synthetic01";
  let mode = "success",
    during: (() => Promise<void>) | undefined;
  const calls: string[] = [];
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = new URL(String(input)),
        isLoom = url.hostname === "www.loom.com";
      calls.push(url.href);
      assert.equal(
        url.origin + url.pathname,
        isLoom
          ? "https://www.loom.com/v1/oembed"
          : "https://www.youtube.com/oembed",
      );
      assert.deepEqual([...url.searchParams.keys()].sort(), ["format", "url"]);
      assert.equal(url.searchParams.get("url"), isLoom ? loom : youtube);
      assert.equal(url.searchParams.get("format"), "json");
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "manual");
      assert.equal(init?.credentials, "omit");
      assert.deepEqual(
        [...new Headers(init?.headers)],
        [["accept", "application/json"]],
      );
      assert.equal(init?.body, undefined);
      if (during) {
        const action = during;
        during = undefined;
        await action();
      }
      if (mode === "redirect")
        return new Response(null, {
          status: 302,
          headers: { Location: "https://foreign.invalid/player" },
        });
      if (mode === "failure") return new Response(null, { status: 503 });
      if (mode === "large")
        return new Response(" ".repeat(32769), {
          headers: { "Content-Type": "application/json" },
        });
      if (mode === "stream-large")
        return new Response(
          new ReadableStream({
            start(controller) {
              for (let i = 0; i < 5; i++)
                controller.enqueue(new Uint8Array(8192));
              controller.close();
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      if (mode === "invalid-utf8")
        return new Response(new Uint8Array([0xff]), {
          headers: { "Content-Type": "application/json" },
        });
      if (mode === "html")
        return new Response("<script>bad()</script>", {
          headers: { "Content-Type": "text/html" },
        });
      const data = {
        type: "video",
        version: "1.0",
        title: "synthetic-vector-11505",
        provider_name: isLoom ? "Loom" : "YouTube",
        provider_url: isLoom
          ? "https://www.loom.com/"
          : "https://www.youtube.com/",
        html: '<iframe src="https://foreign.invalid/"></iframe><script>bad()</script>',
      };
      if (mode === "foreign") data.provider_url = "https://foreign.invalid/";
      if (mode === "invalid") data.type = "link";
      return Response.json(data);
    });
  try {
    const links = [];
    for (const [url, playerUrl, provider] of [
      [
        loom + "?si=tracking",
        "https://www.loom.com/embed/1234567890abcdef1234567890abcdef",
        "Loom",
      ],
      [
        "https://youtu.be/synthetic01?si=tracking",
        "https://www.youtube-nocookie.com/embed/synthetic01",
        "YouTube",
      ],
    ]) {
      const link = await attach(url);
      links.push(link);
      const response = await load(link.id);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await json(response);
      assert.deepEqual(result, {
        preview: { provider, title: "synthetic-vector-11505", playerUrl },
      });
      assert.ok(!JSON.stringify(result).includes("html"));
      assert.ok(!JSON.stringify(result).includes("foreign.invalid"));
    }
    for (const link of links) {
      for (const next of [
        "redirect",
        "failure",
        "large",
        "stream-large",
        "invalid-utf8",
        "html",
        "foreign",
        "invalid",
      ]) {
        mode = next;
        const before = calls.length;
        const rejected = await json(await load(link.id), 502);
        assert.equal(rejected.error, "provider_unavailable");
        assert.equal(rejected.preview, undefined);
        assert.equal(
          calls.length,
          before + 1,
          "No redirect request or automatic retry",
        );
      }
    }
    mode = "success";
    for (const url of [
      "https://foreign.invalid/video",
      "https://www.youtube.com.evil.invalid/watch?v=synthetic01",
      "https://www.youtube.com/redirect?v=synthetic01",
      "https://www.loom.com/share/not-a-public-video",
      "https://www.youtube.com:8443/watch?v=synthetic01",
      "https://www.youtube.com/watch?v=synthetic01&next=https://foreign.invalid/",
    ]) {
      const link = await attach(url),
        before = calls.length;
      await json(await load(link.id), 422);
      assert.equal(calls.length, before);
    }
    await json(
      await req(`/settings/operators/${ids.maya}/role`, "PATCH", {
        role: "viewer",
      }),
    );
    const storedBefore = await env.DB.prepare(
      "SELECT * FROM issue_links ORDER BY id",
    ).all();
    await json(await load(links[0].id));
    assert.deepEqual(
      (await env.DB.prepare("SELECT * FROM issue_links ORDER BY id").all())
        .results,
      storedBefore.results,
    );
    await json(
      await req(`/settings/operators/${ids.maya}/role`, "PATCH", {
        role: "member",
      }),
    );
    const beforeInvalid = calls.length;
    const endpoint =
      origin + "/api" + base + "/links/" + links[0].id + "/preview";
    await json(
      await app.request(
        endpoint,
        { headers: { cookie: member, origin } },
        { ...env, APP_ORIGIN: origin },
      ),
      403,
    );
    await json(
      await app.request(
        endpoint,
        {
          headers: {
            cookie: member,
            origin: "https://foreign.invalid",
            "X-Vector-Load-Player": "true",
          },
        },
        { ...env, APP_ORIGIN: origin },
      ),
      403,
    );
    await json(
      await req(
        base +
          "/links/" +
          links[0].id +
          "/preview?url=" +
          encodeURIComponent(youtube),
      ),
      400,
    );
    await json(await load(links[0].id, ""), 401);
    const revoked = await testCookie(
      env.DB,
      ids.maya,
      new Date(Date.now() - 1000).toISOString(),
    );
    await json(await load(links[0].id, revoked), 401);
    assert.equal(calls.length, beforeInvalid);
    assert.equal(
      (
        await req(`/settings/teams/${team.id}/privacy`, "PUT", {
          isPrivate: true,
        })
      ).status,
      200,
    );
    const hidden = calls.length;
    await json(await load(links[0].id), 404);
    assert.equal(calls.length, hidden);
    assert.equal(
      (
        await req(`/settings/teams/${team.id}/members/${ids.maya}`, "PUT", {
          role: "member",
        })
      ).status,
      200,
    );
    await json(await load(links[0].id));
    during = async () => {
      assert.equal(
        (await req(`/settings/teams/${team.id}/members/${ids.maya}`, "DELETE"))
          .status,
        200,
      );
    };
    await json(await load(links[0].id), 404);
    assert.equal(
      (
        await req(`/settings/teams/${team.id}/members/${ids.maya}`, "PUT", {
          role: "member",
        })
      ).status,
      200,
    );
    const transient = await testCookie(env.DB, ids.maya);
    // Revoke the same native session at the network boundary, then replay it.
    during = async () => {
      await env.DB.prepare(
        "UPDATE oa_sessions SET revoked_at=? WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)",
      )
        .bind(Date.now(), ids.maya)
        .run();
    };
    assert.equal(
      (await json(await load(links[0].id, transient), 401)).error,
      "unauthenticated",
    );
    const replay = calls.length;
    await json(await load(links[0].id, transient), 401);
    assert.equal(calls.length, replay);
    const comment = await json(
      await req(base + "/comments", "POST", { body: "synthetic-vector-11506" }),
      201,
    );
    const attached = await attach(loom, comment.id);
    await json(await load(attached.id, owner));
    during = async () => {
      assert.equal(
        (await req(base + "/comments/" + comment.id, "DELETE")).status,
        200,
      );
    };
    const removedComment = await json(await load(attached.id, owner), 404);
    assert.equal(removedComment.preview, undefined);
    const erased = calls.length;
    await json(await load(attached.id, owner), 404);
    assert.equal(calls.length, erased);
    assert.equal(
      (
        await env.DB.prepare("SELECT url FROM issue_links WHERE id=?")
          .bind(attached.id)
          .first<any>()
      ).url,
      null,
    );
    const standalone = await attach(youtube);
    await json(await load(standalone.id, owner));
    during = async () => {
      await json(await req(base + "/links/" + standalone.id, "DELETE"));
    };
    const removedLink = await json(await load(standalone.id, owner), 404);
    assert.equal(removedLink.preview, undefined);
    const withdrawn = calls.length;
    await json(await load(standalone.id, owner), 404);
    assert.equal(calls.length, withdrawn, "Deleted sources cannot be replayed");
    const tombstone = await env.DB.prepare(
      "SELECT name,url,deleted_at FROM issue_links WHERE id=?",
    )
      .bind(standalone.id)
      .first<any>();
    assert.equal(tombstone.name, null);
    assert.equal(tombstone.url, null);
    assert.ok(tombstone.deleted_at);
  } finally {
    network.mockRestore();
  }
}
