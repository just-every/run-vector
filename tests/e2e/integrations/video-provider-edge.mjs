import { appendFileSync } from "node:fs";
/** Only the built Worker's outbound edge; the application has no fixture seam. */
export async function videoProviderEdge(request) {
  const url = new URL(request.url);
  if (!["www.loom.com", "www.youtube.com"].includes(url.hostname)) return;
  const loom = url.hostname === "www.loom.com";
  if (
    request.method !== "GET" ||
    url.pathname !== (loom ? "/v1/oembed" : "/oembed")
  )
    throw Error("Unexpected video endpoint");
  const video = new URL(url.searchParams.get("url"));
  if (
    url.searchParams.get("format") !== "json" ||
    request.headers.has("authorization") ||
    request.headers.has("cookie") ||
    request.headers.has("referer") ||
    request.body
  )
    throw Error("Video request exposed excess data");
  appendFileSync(
    process.env.VECTOR_CHANNEL_EDGE,
    JSON.stringify({
      method: "video.oembed",
      provider: loom ? "Loom" : "YouTube",
      url: url.href,
    }) + "\n",
  );
  if (video.searchParams.get("v") === "synthetic02")
    return new Response(null, { status: 503 });
  if (video.searchParams.get("v") === "synthetic03")
    return new Response(null, {
      status: 302,
      headers: { location: "https://foreign.invalid/player" },
    });
  return Response.json({
    version: "1.0",
    type: "video",
    provider_name: loom ? "Loom" : "YouTube",
    provider_url: url.origin + "/",
    title: loom ? "Recorded walkthrough" : "Recorded demonstration",
    width: 640,
    height: 360,
    html: '<iframe src="https://foreign.invalid/player"></iframe><script>bad()</script>',
  });
}
