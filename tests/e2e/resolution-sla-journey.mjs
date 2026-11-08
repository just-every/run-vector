import {
  createAdminRuntime,
  bootstrapOwner,
} from "./admin-runtime-support.mjs";
import { writeRuntimeD1 } from "./runtime-d1.mjs";
import { freePort } from "@runeditrun/rer/adapter-settings";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import axe from "axe-core";
import { confirmLink } from "./outbox-session.mjs";
import { navigate, settleReads } from "./collaboration-navigation.mjs";
/** One mounted native configuration and real scheduler journey. Assertions run
 * at desktop width; phone screenshots inspect the same persisted state. */
export async function exerciseResolutionSla({
  page,
  runtime,
  cookie,
  team,
  evidence,
}) {
  const output = join(evidence, "resolution-sla");
  await mkdir(output, { recursive: true });
  const errors = [],
    onError = (e) => errors.push(e.message),
    onConsole = (m) => {
      if (m.type() === "error" && /hydrat|did not match/i.test(m.text()))
        errors.push(m.text());
    };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  const send = async (path, method = "GET", body, session = cookie) => {
    const response = await runtime.req("/api" + path, {
      method,
      headers: {
        Cookie: session,
        Origin: runtime.base,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.ok(
      response.ok,
      `${method} ${path} returned ${response.status}: ${await response.clone().text()}`,
    );
    return response.json();
  };
  try {
    const originalTimezone = (await send("/settings")).workspace.timezone;
    await send("/settings", "PATCH", { timezone: "UTC" });
    await runtime.freshRequestWindow();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate(
      page,
      runtime.base + `/app/settings/teams/${team.id}/automation`,
    );
    const form = page.getByRole("form", {
      name: "Resolution SLA target",
      exact: true,
    });
    await form.waitFor();
    await form.getByLabel("Enable resolution target", { exact: true }).check();
    await form
      .getByLabel("Matching priority", { exact: true })
      .selectOption("urgent");
    await form.getByLabel("Matching label", { exact: true }).selectOption("");
    await form
      .getByLabel("Resolve within (business minutes)", { exact: true })
      .fill("120");
    await form
      .getByLabel("Warn before (business minutes)", { exact: true })
      .fill("60");
    await form
      .getByLabel("Business hours start", { exact: true })
      .fill("00:00");
    await form.getByLabel("Business hours end", { exact: true }).fill("23:59");
    for (const day of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
      await form.getByLabel(day, { exact: true }).check();
    const saved = page.waitForResponse(
      (r) => r.url().endsWith("/sla") && r.request().method() === "PUT",
    );
    await form
      .getByRole("button", { name: "Save resolution SLA", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    assert.equal((await saved).status(), 200);
    await page
      .getByRole("status")
      .filter({ hasText: "Resolution SLA saved." })
      .waitFor();
    await page.reload();
    await form.waitFor();
    assert.equal(
      await form
        .getByLabel("Resolve within (business minutes)", { exact: true })
        .inputValue(),
      "120",
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await settleReads(page);
      await page
        .getByRole("region", { name: "Resolution SLA", exact: true })
        .scrollIntoViewIfNeeded();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "configuration fits viewport",
      );
      if (width === 1440) {
        await page.addScriptTag({ content: axe.source });
        const audit = await page.evaluate(async () =>
          window.axe.run(".sla-settings", {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          }),
        );
        assert.deepEqual(
          audit.violations.map((v) => v.id),
          [],
        );
      }
      await page.screenshot({ path: join(output, `settings-${width}.png`) });
    }
    const owner = await send("/session");
    const email = ["synthetic-vector-193", "vector.test"].join("@");
    await send("/settings/operators/invite", "POST", {
      email,
      displayName: "synthetic-vector-193",
    });
    const text = runtime.sql(
      "SELECT json_extract(message,'$.text') text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='" +
        email +
        "' ORDER BY sequence DESC LIMIT 1",
    )[0].text;
    const confirmed = await confirmLink(text.match(/https?:\/\/[^\s]+/)[0]);
    assert.equal(confirmed.status, 303);
    const memberCookie = confirmed.headers.get("set-cookie").split(";")[0];
    const issue = await send(
      "/issues",
      "POST",
      {
        title: "synthetic-vector-193",
        teamId: team.id,
        priority: "urgent",
        assigneeOperatorId: owner.operatorId,
      },
      memberCookie,
    );
    const start = Date.parse("2030-10-07T12:00:00Z");
    await runtime.writeFixture([
      {
        sql: "UPDATE issue_sla_clocks SET started_at=?,observed_at=? WHERE issue_id=?",
        params: [
          new Date(start).toISOString(),
          new Date(start).toISOString(),
          issue.id,
        ],
      },
    ]);
    const tick = async (time) => {
      const response = await runtime.req(
        "/cdn-cgi/local/scheduled?cron=" +
          encodeURIComponent("* * * * *") +
          "&time=" +
          time,
      );
      assert.equal(response.status, 200);
      await response.text();
    };
    const notices = async () =>
      (await send("/notifications?limit=50")).items.filter(
        (n) =>
          n.identifier === issue.identifier && n.causes.includes("sla_warning"),
      );
    await tick(start + 59 * 60000);
    assert.equal((await notices()).length, 0, "no early warning");
    await tick(start + 60 * 60000 + 1000);
    await tick(start + 60 * 60000 + 1000);
    assert.equal(
      (await notices()).length,
      1,
      "one warning across repeated native ticks",
    );
    await settleReads(page);
    await page.goto("about:blank");
    await runtime.stop();
    await runtime.start();
    await runtime.ready();
    assert.equal(
      (await send("/issues/" + issue.identifier + "/sla")).state,
      "running",
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await navigate(page, runtime.base + "/app/issues/" + issue.identifier);
      const countdown = page.getByRole("note", {
        name: "Resolution SLA remaining time",
        exact: true,
      });
      await countdown.waitFor();
      if (width === 1440)
        assert.match(
          await countdown.innerText(),
          /60 business minutes remaining/,
        );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "countdown fits viewport",
      );
      await page.screenshot({ path: join(output, `countdown-${width}.png`) });
      await navigate(page, runtime.base + "/app/inbox");
      const row = page
        .locator(".inbox-row")
        .filter({ hasText: issue.identifier })
        .filter({ hasText: /SLA warning/ });
      await row.waitFor();
      if (width === 1440) {
        assert.equal(await row.count(), 1);
        assert.match(await row.innerText(), /SLA warning/);
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Inbox fits viewport",
      );
      await page.screenshot({ path: join(output, `inbox-${width}.png`) });
    }
    await tick(start + 120 * 60000 + 1000);
    await tick(start + 121 * 60000);
    assert.deepEqual(
      runtime
        .sql(
          "SELECT kind,count(*) n FROM issue_sla_occurrences WHERE issue_id='" +
            issue.id +
            "' GROUP BY kind ORDER BY kind",
        )
        .map(({ kind, n }) => [kind, n]),
      [
        ["breach", 1],
        ["warning", 1],
      ],
    );
    assert.equal((await notices()).length, 1);
    // An archive and restoration between real scheduler requests is a durable
    // withdrawal. The issue must show its stopped clock after native reload.
    const archived = await send("/issues", "POST", {
      title: "synthetic-vector-197", teamId: team.id, priority: "urgent",
      assigneeOperatorId: owner.operatorId,
    }, memberCookie);
    await send(`/settings/teams/${team.id}`, "PATCH", { archived: true });
    await send(`/settings/teams/${team.id}`, "PATCH", { archived: false });
    const archiveStop = await send(`/issues/${archived.identifier}/sla`);
    assert.equal(archiveStop.state, "stopped");
    assert.ok(archiveStop.stoppedAt);
    await tick(start + 122 * 60000);
    const afterTick = await send(`/issues/${archived.identifier}/sla`);
    assert.equal(afterTick.state, "stopped");
    assert.equal(afterTick.remainingMinutes, archiveStop.remainingMinutes);
    assert.equal(runtime.sql("SELECT count(*) n FROM issue_sla_occurrences WHERE issue_id='" + archived.id + "'")[0].n, 0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await navigate(page, runtime.base + "/app/issues/" + archived.identifier);
      const countdown = page.getByRole("note", { name: "Resolution SLA remaining time", exact: true });
      await countdown.waitFor();
      if (width === 1440) assert.match(await countdown.innerText(), /Stopped/);
      await page.screenshot({ path: join(output, `archive-countdown-${width}.png`) });
    }
    assert.deepEqual(errors, [], "no hydration or browser errors");
    const labelState = await send("/settings/labels", "POST", {
      name: "synthetic-vector-193",
      color: "#4f46e5",
    });
    const selectedLabel = labelState.labels.find(
      (label) => label.name === "synthetic-vector-193",
    );
    await send(`/settings/teams/${team.id}/sla`, "PUT", {
      ...(await send(`/settings/teams/${team.id}/sla`)).rule,
      priority: null,
      labelId: selectedLabel.id,
    });
    await navigate(
      page,
      runtime.base + `/app/settings/teams/${team.id}/automation`,
    );
    await form.waitFor();
    assert.equal(
      await form.getByLabel("Matching priority", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await form.getByLabel("Matching label", { exact: true }).inputValue(),
      selectedLabel.id,
    );
    await send(`/settings/teams/${team.id}/sla`, "PUT", {
      ...(await send(`/settings/teams/${team.id}/sla`)).rule,
      enabled: false,
    });
    await send("/settings", "PATCH", { timezone: originalTimezone });
    console.log(
      "PROBE AUTO-004 browser: native team Settings -> persistent target, countdown and one Inbox warning at 1440 and 390; real fixed-clock scheduler -> no early warning and one breach.",
    );
  } finally {
    page.off("pageerror", onError);
    page.off("console", onConsole);
  }
}

/** The future clock runs in its own native administration workspace, keeping
 * unrelated integration fixtures and cycle closure outside this journey. */
export async function runResolutionSlaRuntime({ browser, evidence }) {
  const native = createAdminRuntime(1440, [], {
    port: await freePort(),
    inspectorPort: 0,
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.setDefaultTimeout(20000);
  const runtime = {
    ...native,
    ready: async () => {},
    req: (path, init = {}) =>
      fetch(native.base + path, {
        redirect: "manual",
        ...init,
        headers: { ...init.headers, Connection: "close" },
      }),
    writeFixture: (sql) => writeRuntimeD1(native.base, sql),
    freshRequestWindow: () =>
      writeRuntimeD1(
        native.base,
        "DELETE FROM access_rate_limits WHERE key LIKE 'operator:%'",
      ),
  };
  try {
    native.initialize();
    await native.start();
    await bootstrapOwner(page, native);
    const cookie = (await context.cookies(native.base))
      .map((row) => row.name + "=" + row.value)
      .join(";");
    const response = await runtime.req("/api/settings/administration", {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    await exerciseResolutionSla({
      page,
      runtime,
      cookie,
      team: data.teams[0],
      evidence,
    });
  } catch (error) {
    await mkdir(evidence, { recursive: true });
    await page
      .screenshot({ path: join(evidence, "resolution-sla-failure.png") })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
    await native.stop();
  }
}
