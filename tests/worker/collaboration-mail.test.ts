import { env } from "cloudflare:workers";
import { expect, it, vi } from "vitest";
import { contractWith } from "../contract-tags";
import { collaborationFixture, count } from "./collaboration-fixture";
import { bindings } from "./base-auth-fixture";
import {
  drainNotificationMail,
  CLAIM_TIMEOUT_MS,
} from "../../src/core/features/notifications/mail";
import {
  changeSubscription,
  changePreferences,
} from "../../src/core/features/notifications/mutations";
import { removeOperator } from "../../src/core/features/settings/removal";
const remote = {
  ...bindings,
  APP_ORIGIN: "https://vector.example.test",
  MAIL_MODE: "sendgrid",
  MAIL_PROVIDER: "sendgrid",
  MAIL_API_KEY: "synthetic-test-recording-only-key",
};
contractWith(
  it,
  "NOTIFY-006 BASE-DATA-004 BASE-OPS-003 BASE-OPS-004",
  "real Base facade sends one minimal request across competing drains and never replays accepted or uncertain outcomes, retries definite rejections finitely, and retains crash claims",
  async () => {
    const f = await collaborationFixture();
    await f.pending(
      {
        description: "SECRET_BODY_SENTINEL",
        expectedOutcome: "SECRET_OUTCOME",
      },
      remote,
    );
    const calls: string[] = [];
    const recording: typeof fetch = async (_request, init) => {
      calls.push(String(init?.body));
      return new Response(null, { status: 202 });
    };
    await Promise.all([
      drainNotificationMail(remote, { dependencies: { fetch: recording } }),
      drainNotificationMail(remote, { dependencies: { fetch: recording } }),
    ]);
    expect(calls).toHaveLength(1);
    const wire = JSON.parse(calls[0]);
    expect(wire.content).toHaveLength(1);
    expect(wire.content[0].type).toBe("text/plain");
    expect(calls[0]).not.toContain("SECRET_BODY_SENTINEL");
    expect(calls[0]).not.toContain("SECRET_OUTCOME");
    expect(calls[0]).not.toContain("attachments");
    expect(wire.tracking_settings.click_tracking.enable).toBe(false);
    expect(wire.tracking_settings.open_tracking.enable).toBe(false);
    expect(wire.content[0].value).toContain("Sign in to view");
    expect(wire.content[0].value).toContain(
      "https://vector.example.test/app/issues/BASE-",
    );
    await drainNotificationMail(remote, {
      scheduled: true,
      dependencies: { fetch: recording },
    });
    expect(calls).toHaveLength(1);
    await f.pending({}, remote);
    const uncertain: typeof fetch = async () => {
      calls.push("uncertain");
      throw new Error("test timeout");
    };
    await drainNotificationMail(remote, { dependencies: { fetch: uncertain } });
    expect(await count("notification_deliveries", "status='uncertain'")).toBe(
      1,
    );
    await drainNotificationMail(remote, {
      scheduled: true,
      dependencies: { fetch: recording },
    });
    expect(calls).toHaveLength(2);
    const prefs = await f.data(f.bobCookie, "/settings/notifications");
    expect(prefs.deliveries[0].status).toBe("uncertain");
    await proveFiniteNotificationRetries();
  },
);
contractWith(
  it,
  "NOTIFY-006 NOTIFY-004 OPS-004 BASE-DATA-003",
  "final admission observes opt-out and issue mute, erasure removes intents/captures, and late settlement cannot resurrect them",
  async () => {
    const f = await collaborationFixture();
    let calls = 0;
    const recording: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 202 });
    };
    const issue = await f.pending({}, remote);
    await drainNotificationMail(remote, {
      dependencies: {
        fetch: recording,
        beforeAdmission: async () =>
          changeSubscription(env.DB, f.bob, issue.identifier, { muted: true }),
      },
    });
    expect(calls).toBe(0);
    expect(await count("notification_deliveries", "status='suppressed'")).toBe(
      1,
    );
    await f.pending({}, remote);
    await drainNotificationMail(remote, {
      dependencies: {
        fetch: recording,
        beforeAdmission: async () =>
          changePreferences(env.DB, f.bob, { emailEnabled: false }),
      },
    });
    expect(calls).toBe(0);
    await changePreferences(env.DB, f.bob, { emailEnabled: true });
    const late = await f.pending({}, remote);
    const erase: typeof fetch = async () => {
      calls++;
      await env.DB.prepare("DELETE FROM issues WHERE identifier=?")
        .bind(late.identifier)
        .run();
      return new Response(null, { status: 202 });
    };
    await drainNotificationMail(remote, { dependencies: { fetch: erase } });
    expect(calls).toBe(1);
    expect(
      await count("notification_deliveries", "identifier=?", [late.identifier]),
    ).toBe(0);
    await f.pending({}, remote);
    await drainNotificationMail(bindings);
    expect(await count("notification_development_mail")).toBe(1);
    await removeOperator(env.DB, f.owner, f.bob);
    for (const table of [
      "notification_deliveries",
      "notification_development_mail",
      "notification_delivery_attempts",
      "notification_preferences",
      "issue_notification_mutes",
      "notifications",
    ])
      expect(await count(table), table).toBe(0);
  },
);

async function proveFiniteNotificationRetries() {
    const f = await collaborationFixture(),
      clock = new Date();
    await f.pending({}, remote);
    let calls = 0;
    const reject: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 429 });
    };
    await drainNotificationMail(remote, {
      now: clock,
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(1);
    await drainNotificationMail(remote, {
      now: new Date(clock.getTime() + 60_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(1);
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(clock.getTime() + 60_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(2);
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(clock.getTime() + 360_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(3);
    expect(
      await count(
        "notification_deliveries",
        "status='failed' AND reason='retry_exhausted'",
      ),
    ).toBe(1);
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(clock.getTime() + 7200_000),
      dependencies: { fetch: reject },
    });
    expect(calls).toBe(3);
    await f.pending({}, remote);
    await expect(
      drainNotificationMail(remote, {
        dependencies: {
          beforeAdmission: async () => {
            throw new Error("claim crash");
          },
          fetch: reject,
        },
      }),
    ).rejects.toThrow("claim crash");
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(Date.now() + CLAIM_TIMEOUT_MS + 1000),
      dependencies: { fetch: reject },
    });
    expect(await count("notification_deliveries", "status='uncertain'")).toBe(
      1,
    );
    expect(calls).toBe(3);
    await f.pending({}, remote);
    const accepted: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 202 });
    };
    await expect(
      drainNotificationMail(remote, {
        dependencies: {
          fetch: accepted,
          afterSubmission: async () => {
            throw new Error("settlement persistence crash");
          },
        },
      }),
    ).rejects.toThrow("settlement persistence crash");
    await drainNotificationMail(remote, {
      scheduled: true,
      now: new Date(Date.now() + CLAIM_TIMEOUT_MS + 1000),
      dependencies: { fetch: accepted },
    });
    expect(await count("notification_deliveries", "status='uncertain'")).toBe(
      2,
    );
    expect(calls).toBe(4);

}

contractWith(it,'TRIAGE-005 ROLE-003 ROLE-009 BASE-DATA-004','provider mail becomes one intake conversation with bounded attachments, once-only Member replies, signature-verified bounces, and no Guest sending',async()=>{
  const {seedIntakeForTeam,inboundFixture,recordedReply,recordSendGrid,mailBindings}=await import('./email-intake-fixture');
  const {request}=await import('./base-auth-fixture');
  const {default:worker}=await import('./entry');
  const f=await collaborationFixture(), teamId=f.initial.teams[0].id;
  const intake=await seedIntakeForTeam(teamId,f.cookie,true);
  const context=await f.data(f.cookie,`/issues/${intake.identifier}/email-intake`);
  expect(context.thread).toMatchObject({requester:'synthetic-vector-712@example.test',requesterDomain:'example.test',messageId:intake.messageId});
  expect(context.messages[0].attachments).toHaveLength(2);
  expect(context.messages[0].attachments.find((a:any)=>a.contentType==='image/png').contentId).toBe('delivery-image');
  expect(await count('operators','email=?',['synthetic-vector-712@example.test'])).toBe(0);
  expect(context.customerMappingAvailable).toBe(false);
  expect((await f.any(f.bobCookie,`/settings/teams/${teamId}/email-intake`)).status).toBe(403);
  expect((await f.any(f.bobCookie,`/settings/teams/${teamId}/email-intake`,'PUT',intake.settings)).status).toBe(403);
  expect((await f.any(f.cookie,`/settings/teams/${teamId}/permissions`,'PUT',{settings:'all_members',planning:'team_owners'})).status).toBe(200);
  expect((await f.any(f.bobCookie,`/teams/${teamId}/join`,'POST',{})).status).toBe(200);
  expect((await f.any(f.bobCookie,`/settings/teams/${teamId}/email-intake`)).status).toBe(200);
  const duplicate=inboundFixture(intake.address,intake.messageId,{attachments:true});
  expect((await worker.email(duplicate.message,mailBindings)).status).toBe('duplicate');
  const denied=inboundFixture(intake.address,'<synthetic-vector-715@example.test>',{from:'synthetic-vector-716@example.test'});
  expect((await worker.email(denied.message,mailBindings)).status).toBe('rejected');expect(denied.rejected()).toBeTruthy();
  const image=context.messages[0].attachments.find((a:any)=>a.contentType==='image/png');
  const reply=await recordedReply(f.bobCookie,intake.identifier,`We are investigating. ![Delivery](/api/issues/${intake.identifier}/files/${image.fileId})`);
  expect(reply.response.status,await reply.response.clone().text()).toBe(201);
  const outcome=await reply.response.json() as any;expect(outcome.status).toBe('accepted');
  expect(reply.calls).toHaveLength(1);expect(reply.calls[0].url).toBe('https://api.sendgrid.com/v3/mail/send');
  const wire=reply.calls[0].body;expect(wire.headers['In-Reply-To']).toBe(intake.messageId);expect(wire.headers.References).toContain(intake.messageId);
  expect(wire.personalizations[0].to).toEqual([{email:'synthetic-vector-712@example.test'}]);expect(wire.personalizations[0].cc).toEqual([{email:'synthetic-vector-713@example.test'}]);
  expect(wire.attachments).toHaveLength(1);expect(wire.attachments[0].disposition).toBe('inline');expect(wire.content.find((c:any)=>c.type==='text/html').value).toContain('cid:');expect(JSON.stringify(wire.content)).not.toContain('/api/issues/');
  const repeat=await recordedReply(f.bobCookie,intake.identifier,'Never send a changed retry',reply.requestId);
  expect(repeat.calls).toHaveLength(0);expect(await repeat.response.json()).toMatchObject({commentId:outcome.commentId,status:'accepted'});
  let internalSends=0;vi.stubGlobal('fetch',async()=>{internalSends++;return new Response(null,{status:202});});
  try {const internal=await f.any(f.bobCookie,`/issues/${intake.identifier}/comments`,'POST',{body:'Internal routing detail'});expect(internal.status).toBe(201);expect(internalSends).toBe(0);}finally{vi.unstubAllGlobals();}
  const native=(await f.data(f.cookie,`/issues/${intake.identifier}/discussion`));expect(JSON.stringify(native)).toContain('Internal routing detail');
  const answer=inboundFixture(intake.address,'<synthetic-vector-717@example.test>',{replyTo:wire.headers['Message-ID']});
  expect((await worker.email(answer.message,mailBindings)).status).toBe('received');
  const discussion=await f.data(f.cookie,`/issues/${intake.identifier}/discussion`);
  expect(discussion.comments).toEqual(expect.arrayContaining([expect.objectContaining({parentId:outcome.commentId,actor:'synthetic-vector-712@example.test'})]));
  expect((await f.any(f.cookie,`/settings/operators/${f.cara}/role`,'PATCH',{role:'guest',teamIds:[teamId]})).status).toBe(200);
  const guest=await recordedReply(f.caraCookie,intake.identifier,'Guest external reply');expect(guest.response.status).toBe(403);expect(guest.calls).toHaveLength(0);
  expect((await f.any(f.caraCookie,`/settings/teams/${teamId}/email-intake`)).status).toBe(403);
  const after=await f.data(f.cookie,`/issues/${intake.identifier}/email-intake`);expect(after.deliveries).toHaveLength(1);expect(after.messages).toHaveLength(2);
  expect((await f.any(f.bobCookie,`/settings/teams/${teamId}/email-intake`,'PUT',{...intake.settings,acknowledgement:true})).status).toBe(200);
  const ackId='<synthetic-vector-718@example.test>';
  const ack=await recordSendGrid(()=>worker.email(inboundFixture(intake.address,ackId).message,mailBindings));
  expect(ack.result.status).toBe('received');expect(ack.calls).toHaveLength(1);
  expect(JSON.stringify(ack.calls[0].body.content)).toContain(ack.result.identifier);
  const ackAgain=await recordSendGrid(()=>worker.email(inboundFixture(intake.address,ackId).message,mailBindings));
  expect(ackAgain.result.status).toBe('duplicate');expect(ackAgain.calls).toHaveLength(0);
  const {proveEmailBounces}=await import('./email-bounce-scenario');
  await proveEmailBounces(f,intake,outcome.commentId,reply.calls[0].providerId,reply.calls[0].body.custom_args.rer_delivery_id,ack);

});
