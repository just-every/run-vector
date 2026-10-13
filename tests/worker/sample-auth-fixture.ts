import { expect } from "vitest";
import { bindings, origin, request, mailToken } from "./base-auth-fixture";
export { origin };
export const sampleBindings = {
  ...bindings,
  FIRST_OWNER_EMAIL: "sarah@vector.test",
};
async function admit(email: string, ownerCookie?: string) {
  const response = ownerCookie
    ? await request(
        "/api/settings/operators/invite",
        "POST",
        { email, displayName: "Race operator" },
        ownerCookie,
        sampleBindings,
      )
    : await request("/auth/request", "POST", { email }, "", sampleBindings);
  expect(response.status).toBe(202);
  const token = await mailToken(email);
  const preview = await request(
    "/auth/confirm?token=" + token,
    "GET",
    undefined,
    "",
    sampleBindings,
  );
  expect(preview.status).toBe(200);
  expect(preview.headers.get("set-cookie")).toBeNull();
  const confirmed = await request(
    "/auth/confirm",
    "POST",
    { token },
    "",
    sampleBindings,
  );
  expect(confirmed.status).toBe(303);
  const cookie = confirmed.headers.get("set-cookie")!.split(";")[0];
  const session = await request(
    "/api/session",
    "GET",
    undefined,
    cookie,
    sampleBindings,
  );
  expect(session.status).toBe(200);
  const { operatorId: id } = (await session.json()) as { operatorId: string };
  return { id, cookie };
}
export async function sampleOwner() {
  return (await admit(sampleBindings.FIRST_OWNER_EMAIL)).cookie;
}
export async function samplePeer(ownerCookie: string) {
  return admit(`race-${crypto.randomUUID()}@vector.test`, ownerCookie);
}
export async function sampleSession(cookie: string, status = 200) {
  expect(
    (await request("/api/session", "GET", undefined, cookie, sampleBindings))
      .status,
  ).toBe(status);
}
