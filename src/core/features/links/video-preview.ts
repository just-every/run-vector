import { z } from "zod";
import type { PublicVideo } from "./public-video";

const metadata = z.object({
  type: z.literal("video"),
  version: z.literal("1.0"),
  title: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  provider_name: z.enum(["Loom", "YouTube"]),
  provider_url: z.string().url(),
});

/** Fixed oEmbed endpoints, finite body and deadline; returned HTML is never used. */
export async function videoPreview(video: PublicVideo) {
  const endpoint = new URL(
    video.provider === "Loom"
      ? "https://www.loom.com/v1/oembed"
      : "https://www.youtube.com/oembed",
  );
  endpoint.searchParams.set("url", video.url);
  endpoint.searchParams.set("format", "json");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 5000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(endpoint.href, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (
      response.status !== 200 ||
      response.redirected ||
      !/^application\/json(?:\s*;|$)/i.test(
        response.headers.get("content-type") ?? "",
      ) ||
      Number(response.headers.get("content-length") ?? 0) > 32768 ||
      !response.body
    )
      throw Error("Invalid provider response");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 32768) throw Error("Provider response too large");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed = metadata.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    const origin = new URL(parsed.provider_url).origin;
    if (
      parsed.provider_name !== video.provider ||
      origin !==
        (video.provider === "Loom"
          ? "https://www.loom.com"
          : "https://www.youtube.com")
    )
      throw Error("Foreign provider");
    return {
      provider: video.provider,
      title: parsed.title,
      playerUrl: video.playerUrl,
    };
  } finally {
    clearTimeout(timer);
    await reader?.cancel().catch(() => {});
    controller.abort();
  }
}
