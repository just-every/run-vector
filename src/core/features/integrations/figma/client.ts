import { figmaEgress } from "../native-egress.mjs";
import { z } from "zod";
import { IntegrationError } from "../errors";

export class FigmaResponseError extends Error {
  constructor(readonly status: number) {
    super("Figma could not load this request.");
  }
}

/** Fixed API destinations, no redirects, finite wire bodies and deadlines. */
export async function figmaRequest(
  path: string,
  token?: string,
) {
  if (
    !/^\/(?:v1\/files\/[A-Za-z0-9]{1,128}\/nodes\?ids=[0-9%3A]+&depth=1|v1\/images\/[A-Za-z0-9]{1,128}\?ids=[0-9%3A]+&format=png&scale=1)$/.test(
      path,
    )
  )
    throw Error("Invalid Figma endpoint");
  return boundedFetch(
    "https://api.figma.com" + path,
    65536,
    "application/json",
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
    },
  );
}
export async function boundedFetch(
  url: string,
  limit: number,
  contentType: string,
  init: RequestInit = {},
) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 5000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await figmaEgress(url, {
      ...init,
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (response.status !== 200 || response.redirected)
      throw new FigmaResponseError(response.status);
    if (
      !(
        (response.headers.get("content-type") ?? "")
          .toLowerCase()
          .split(";")[0]
          .trim() === contentType
      ) ||
      Number(response.headers.get("content-length") ?? 0) > limit ||
      !response.body
    )
      throw Error("Invalid Figma response");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) throw Error("Figma response exceeds limit");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    controller.abort();
    clearTimeout(timer);
    await reader?.cancel().catch(() => {});
  }
}
const bearer = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => !/[\s\u0000-\u001f\u007f]/.test(value));
const grant = z.object({
  access_token: bearer,
  refresh_token: bearer,
  expires_in: z.number().int().positive().max(31536000),
  token_type: z.string().optional(),
});
export async function exchangeCode(
  clientId: string,
  secret: string,
  code: string,
  callback: string,
) {
  const form = new URLSearchParams({
    redirect_uri: callback,
    code,
    grant_type: "authorization_code",
  });
  try {
    const value = grant.parse(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await boundedFetch(
            "https://api.figma.com/v1/oauth/token",
            65536,
            "application/json",
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                Authorization: "Basic " + btoa(clientId + ":" + secret),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: form.toString(),
            },
          ),
        ),
      ),
    );
    if (value.token_type && value.token_type.toLowerCase() !== "bearer")
      throw Error("Invalid Figma grant");
    return {
      token: value.access_token,
      refresh: value.refresh_token,
      expires: Date.now() + value.expires_in * 1000,
    };
  } catch {
    throw new IntegrationError(
      503,
      "figma_connection_failed",
      "Figma could not connect your account. Start a fresh connection.",
    );
  }
}
export const decodeFigma = (bytes: Uint8Array): unknown =>
  JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
