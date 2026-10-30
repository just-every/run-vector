import { isSafeHttpsUrl } from "./schema";

export type PublicVideo = {
  provider: "Loom" | "YouTube";
  url: string;
  playerUrl: string;
};

/** Only public video identities; tracking parameters never reach the provider. */
export function publicVideo(value: string): PublicVideo | null {
  if (!isSafeHttpsUrl(value)) return null;
  const url = new URL(value);
  if (url.port || url.hash) return null;
  if (
    [...url.searchParams.keys()].some(
      (key) => !["v", "t", "si", "feature"].includes(key),
    )
  )
    return null;
  if (["loom.com", "www.loom.com"].includes(url.hostname)) {
    const id = /^\/share\/([a-f0-9]{32})\/?$/.exec(url.pathname)?.[1];
    return id
      ? {
          provider: "Loom",
          url: `https://www.loom.com/share/${id}`,
          playerUrl: `https://www.loom.com/embed/${id}`,
        }
      : null;
  }
  let id: string | undefined;
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  ) {
    id =
      url.pathname === "/watch" && url.searchParams.getAll("v").length === 1
        ? (url.searchParams.get("v") ?? undefined)
        : /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  } else if (url.hostname === "youtu.be")
    id = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  return id && /^[A-Za-z0-9_-]{11}$/.test(id)
    ? {
        provider: "YouTube",
        url: `https://www.youtube.com/watch?v=${id}`,
        playerUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      }
    : null;
}
