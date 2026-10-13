// A held response is fetched on its own connection. Playwright's route.fetch
// client pools keep-alive sockets with no idle limit while the dev server closes
// an idle socket after 5 s; a request sent on a socket at that moment fails with
// "socket hang up" (vector-r1 part 0 evidence). Closing each connection after its
// response leaves no pooled socket to go stale.
export function fetchHeld(route) {
  return route.fetch({ headers: { ...route.request().headers(), connection: "close" } });
}
