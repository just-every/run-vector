/** Only canonical Figma file identities cross the provider boundary. */
export function figmaLink(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !["www.figma.com", "figma.com"].includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    return null;
  const match = /^\/(?:file|design)\/([A-Za-z0-9]{1,128})(?:\/[^/]*)?\/?$/.exec(
    url.pathname,
  );
  if (
    !match ||
    [...url.searchParams.keys()].some(
      (key) => !["node-id", "t"].includes(key),
    ) ||
    url.searchParams.getAll("node-id").length > 1
  )
    return null;
  const node = url.searchParams.get("node-id")?.replace("-", ":") ?? "0:1";
  if (!/^\d{1,12}:\d{1,12}$/.test(node)) return null;
  return {
    key: match[1],
    node,
    url:
      "https://www.figma.com/design/" +
      match[1] +
      "?node-id=" +
      node.replace(":", "-"),
  };
}

export function figmaOrigin(value: string) {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw Error("Invalid installation origin");
  return url.origin;
}
export function figmaCallback(origin: string) {
  return figmaOrigin(origin) + "/api/settings/figma/callback";
}
export function pluginManifest(origin: string) {
  return {
    name: "Vector",
    api: "1.0.0",
    main: "code.js",
    editorType: ["figma"],
    networkAccess: { allowedDomains: [figmaOrigin(origin)] },
  };
}
