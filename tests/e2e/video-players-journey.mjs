import assert from "node:assert/strict";
import { confirmLink } from "./outbox-session.mjs";
import { openAuthenticatedPage } from "./ui-runtime-auth.mjs";
import { readFile } from "node:fs/promises";
import { roleScreens } from "./role-ui-support.mjs";
import {
  navigate,
  settleReads,
  trackRequests,
} from "./collaboration-navigation.mjs";

export async function exerciseVideoPlayers({
  page: shared,
  runtime,
  cookie,
  team,
  evidence,
}) {
  await runtime.freshRequestWindow();
  const page = await shared.context().newPage(),
    errors = [],
    inspect = roleScreens(evidence);
  page.on("pageerror", (error) => errors.push(error.message));
  trackRequests(page);
  const headers = {
    Cookie: cookie,
    Origin: runtime.base,
    "Content-Type": "application/json",
  };
  const api = async (path, method = "GET", data, status = 200) => {
    const r = await runtime.req("/api" + path, {
      method,
      headers,
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    assert.equal(r.status, status, await r.clone().text());
    return r.json();
  };
  const calls = async () => {
    try {
      return (await readFile(process.env.VECTOR_CHANNEL_EDGE, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((row) => row.method === "video.oembed");
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  };
  const playerOrigins = [
    "https://www.loom.com",
    "https://www.youtube-nocookie.com",
  ];
  // Browser edge models a controllable player document at each real player URL.
  // HTML returned by oEmbed points elsewhere and must never become this document.
  const playerRoute = async (route) => {
    const provider =
      new URL(route.request().url()).hostname === "www.loom.com"
        ? "Loom"
        : "YouTube";
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><title>${provider} fixture player</title><body><button onclick="this.textContent='Playing'">Play video</button></body></html>`,
    });
  };
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const origin of playerOrigins)
      await page.route(origin + "/**", playerRoute);
    const created = await api(
        "/issues",
        "POST",
        {
          teamId: team.id,
          title: "Public video walkthroughs",
          description: "Private issue body stays in Vector.",
        },
        201,
      ),
      path = "/issues/" + created.identifier;
    const definitions = [
      [
        "Loom walkthrough",
        "https://www.loom.com/share/1234567890abcdef1234567890abcdef",
      ],
      ["YouTube demonstration", "https://youtu.be/synthetic01?si=tracking"],
      ["Unavailable recording", "https://www.youtube.com/watch?v=synthetic02"],
      ["Redirected recording", "https://www.youtube.com/watch?v=synthetic03"],
      ["Ordinary external link", "https://foreign.invalid/video"],
    ];
    const links = [];
    for (const [name, url] of definitions)
      links.push(await api(path + "/links", "POST", { name, url }, 201));
    const before = (await calls()).length;
    await navigate(page, runtime.base + "/app/issues/" + created.identifier);
    const region = page.getByRole("region", { name: "Links", exact: true });
    await region.locator("summary").click();
    assert.equal(
      (await calls()).length,
      before,
      "No external load on opening the issue",
    );
    assert.equal(await region.locator("iframe").count(), 0);
    const load = async (provider, name, index, status = 200) => {
      const button = region.getByRole("button", {
        name: `Load ${provider} player for ${name}`,
        exact: true,
      });
      await button.focus();
      assert.equal(
        await button.evaluate((node) => document.activeElement === node),
        true,
      );
      const response = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname ===
          `/api${path}/links/${links[index].id}/preview`,
      );
      await page.keyboard.press("Enter");
      assert.equal((await response).status(), status);
    };
    await load("Loom", "Loom walkthrough", 0);
    await load("YouTube", "YouTube demonstration", 1);
    for (const [provider, name, expected] of [
      [
        "Loom",
        "Loom walkthrough",
        "https://www.loom.com/embed/1234567890abcdef1234567890abcdef",
      ],
      [
        "YouTube",
        "YouTube demonstration",
        "https://www.youtube-nocookie.com/embed/synthetic01",
      ],
    ]) {
      const frame = region.locator(
        `iframe[title^="${provider} player: ${name}"]`,
      );
      assert.equal(await frame.getAttribute("src"), expected);
      assert.equal(
        await frame.getAttribute("sandbox"),
        "allow-scripts allow-same-origin allow-presentation",
      );
      assert.equal(await frame.getAttribute("referrerpolicy"), "strict-origin");
      const play = frame
        .contentFrame()
        .getByRole("button", { name: "Play video", exact: true });
      await play.click();
      await frame
        .contentFrame()
        .getByRole("button", { name: "Playing", exact: true })
        .waitFor();
    }
    assert.equal(
      await region.locator('iframe[src^="https://foreign.invalid"]').count(),
      0,
    );
    assert.equal(
      await region
        .getByRole("button", { name: /Load .*Ordinary external link/ })
        .count(),
      0,
    );
    const first = (await calls()).slice(before);
    assert.deepEqual(
      first.map((row) => row.provider),
      ["Loom", "YouTube"],
    );
    assert.deepEqual(
      first.map((row) => new URL(row.url).searchParams.get("url")),
      [
        "https://www.loom.com/share/1234567890abcdef1234567890abcdef",
        "https://www.youtube.com/watch?v=synthetic01",
      ],
    );
    assert.ok(
      first.every(
        (row) =>
          !row.url.includes("tracking") &&
          !row.url.includes(created.identifier) &&
          !row.url.includes("Private"),
      ),
    );
    await load("YouTube", "Unavailable recording", 2, 502);
    await region
      .getByRole("alert")
      .filter({ hasText: "The video provider could not load this player." })
      .waitFor();
    await load("YouTube", "Redirected recording", 3, 502);
    assert.equal(
      (await calls()).length,
      before + 4,
      "A redirect never reaches another destination",
    );
    // Assert outcomes at desktop width; capture the same changed screen at both widths.
    await inspect(page, region, "docs-public-video-players");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await region
      .getByRole("button", {
        name: "Unload Loom player for Loom walkthrough",
        exact: true,
      })
      .click();
    assert.equal(
      await region.locator('iframe[title^="Loom player:"]').count(),
      0,
    );
    await settleReads(page);
    await page.reload();
    await region.waitFor();
    await region.locator("summary").click();
    assert.equal(
      await region.locator("iframe").count(),
      0,
      "Reload requires renewed explicit load",
    );
    assert.equal((await calls()).length, before + 4);
    const rejected = await runtime.req(
      "/api" + path + "/links/" + links[0].id + "/preview",
      {
        method: "POST",
        headers: { Origin: runtime.base, "Content-Type": "application/json" },
        body: "{}",
      },
    );
    assert.equal(rejected.status, 401);
    await rejected.body.cancel();
    assert.equal(
      (await calls()).length,
      before + 4,
      "Signed-out requests make no provider call",
    );
    const email = ["synthetic-vector-11510", "example.test"].join("@");
    await api(
      "/settings/operators/invite",
      "POST",
      { email, displayName: "Video reader" },
      202,
    );
    const text = runtime.sql(
      `SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='${email}' ORDER BY sequence DESC LIMIT 1`,
    )[0].text;
    const accepted = await confirmLink(text.match(/https?:\/\/[^\s]+/)[0]);
    assert.equal(accepted.status, 303);
    const readerCookie = accepted.headers.get("set-cookie").split(";")[0];
    const reader = await openAuthenticatedPage(
      shared.context().browser(),
      readerCookie,
      runtime.base,
    );
    try {
      const actor = (
        await (
          await runtime.req("/api/session", {
            headers: { Cookie: readerCookie },
          })
        ).json()
      ).operatorId;
      const previewPath =
        runtime.base + "/api" + path + "/links/" + links[0].id + "/preview";
      const ask = () =>
        reader.request.post(previewPath, {
          headers: { Origin: runtime.base },
          data: {},
        });
      let result = await ask();
      assert.equal(result.status(), 200);
      assert.equal((await result.json()).preview.provider, "Loom");
      await api(`/settings/teams/${team.id}/privacy`, "PUT", {
        isPrivate: true,
      });
      const privateBefore = (await calls()).length;
      result = await ask();
      assert.equal(result.status(), 404);
      assert.ok(!(await result.text()).includes("Recorded walkthrough"));
      assert.equal((await calls()).length, privateBefore);
      await api(`/settings/teams/${team.id}/members/${actor}`, "PUT", {
        role: "member",
      });
      result = await ask();
      assert.equal(result.status(), 200);
      await result.body();
      await api(`/settings/teams/${team.id}/members/${actor}`, "DELETE");
      const withdrawn = (await calls()).length;
      result = await ask();
      assert.equal(result.status(), 404);
      assert.equal((await calls()).length, withdrawn);
      const signedOut = await reader.request.post(
        runtime.base + "/auth/signout",
        { headers: { Origin: runtime.base }, data: {} },
      );
      assert.equal(signedOut.status(), 204);
      result = await runtime.req(
        "/api" + path + "/links/" + links[0].id + "/preview",
        {
          method: "POST",
          headers: {
            Cookie: readerCookie,
            Origin: runtime.base,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      assert.equal(result.status, 401);
      await result.body.cancel();
      assert.equal(
        (await calls()).length,
        withdrawn,
        "Replayed signed-out session sends no provider request",
      );
    } finally {
      await reader.context().close();
      await api(`/settings/teams/${team.id}/privacy`, "PUT", {
        isPrivate: false,
      });
    }

    assert.deepEqual(errors, [], "No hydration or browser errors");
    await settleReads(page);
  } finally {
    await page.close();
  }
  console.log(
    "PROBE DOCS-001 Loom: authorized named link -> fixed oEmbed request, controllable restricted player; explicit load, 1440 and 390 proof.",
  );
  console.log(
    "PROBE DOCS-001 YouTube: authorized named link -> fixed oEmbed request, controllable restricted player; provider failure and redirect refused visibly.",
  );
}
