import { useState } from "react";
import type { NamedLink } from "../schema";
import { publicVideo } from "../public-video";

type Preview = { provider: string; title: string; playerUrl: string };
export function VideoPlayer({
  identifier,
  link,
}: {
  identifier: string;
  link: NamedLink;
}) {
  const video = publicVideo(link.url);
  const [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!video) return null;
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/issues/${encodeURIComponent(identifier)}/links/${link.id}/preview`,
        {
          headers: { "X-Vector-Load-Player": "true" },
        },
      );
      const result = (await response.json()) as { preview: Preview };
      if (!response.ok)
        throw Error(
          response.status === 502
            ? "The video provider could not load this player. Try again or open the original link."
            : "This video is unavailable. Refresh the issue and sign in again if needed.",
        );
      if (result.preview.playerUrl !== video?.playerUrl)
        throw Error("This player is unavailable.");
      setPreview(result.preview);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This player is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="named-video"
      role="group"
      aria-label={`${video.provider} video: ${link.name}`}
    >
      <p>
        Loading shares your IP address and this site's origin with{" "}
        {video.provider}.
      </p>
      {preview ? (
        <>
          <iframe
            src={preview.playerUrl}
            title={`${preview.provider} player: ${link.name} — ${preview.title}`}
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin"
          />
          <button type="button" onClick={() => setPreview(null)}>
            Unload {video.provider} player for {link.name}
          </button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void load()}>
          {busy ? "Loading" : "Load"} {video.provider} player for {link.name}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
