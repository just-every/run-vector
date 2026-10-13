import { env } from "cloudflare:workers";
import { createServerApp } from "../../src/core/app/server";
import { testCookie } from "./native-fixture";
import { ids } from "./bulk-parent-fixture";
const origin = "https://vector.test";
export async function deleteRequest(
  identifier: string,
  version: number,
  options: {
    DB?: D1Database;
    FILES?: R2Bucket;
    cookie?: string;
    actor?: string;
    origin?: string;
    body?: unknown;
    authorization?: string;
  } = {},
) {
  const cookie =
    options.cookie ?? (await testCookie(env.DB, options.actor ?? ids.sarah));
  return createServerApp().request(
    origin + "/api/issues/" + identifier,
    {
      method: "DELETE",
      headers: {
        origin: options.origin ?? origin,
        "content-type": "application/json",
        cookie,
        ...(options.authorization
          ? { authorization: options.authorization }
          : {}),
      },
      body: JSON.stringify(
        options.body ?? { expectedVersion: version, confirmed: true },
      ),
    },
    {
      ...env,
      APP_ORIGIN: origin,
      DB: options.DB ?? env.DB,
      FILES: options.FILES ?? env.FILES,
    },
  );
}
