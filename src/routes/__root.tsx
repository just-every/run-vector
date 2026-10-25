import { editorLeaf } from '../core/editor/leaf';
import { loadDoorSession } from '../core/app/door-session';
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useMatch,
} from "@tanstack/react-router";
import { Door } from "../core/app/site/door/door";
import { productConfig } from "../core/app/config";
import { themeCss } from "../core/app/theme";
import "../core/app/app.css";
import { fontLinks } from "../core/app/fonts";
import { introCss, introGuardScript } from "../base/hydration/intro-guard";
export const Route = createRootRoute({
  beforeLoad: async ({ matches, location }): Promise<{ doorSignedIn: boolean }> => ({
    doorSignedIn: location.pathname !== '/' && matches.length === 1 ? await loadDoorSession() : false,
  }),
  head: () => ({
    links: [
      { rel: "icon", type: "image/svg+xml", sizes: "any", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/brand/favicon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/brand/apple-touch-icon.png" },
    ],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Vector" },
      {
        name: "description",
        content: "An owned workspace for evidence and work.",
      },
    ],
  }),
  component: Root,
  notFoundComponent: editorLeaf(PageNotFound),
});
function PageNotFound() {
  const signedIn = Boolean(useMatch({ from: '/app', shouldThrow: false })?.context?.operator) || Route.useRouteContext().doorSignedIn;
  return <Door>
      <p className="vx-door-kicker">404 · Page not found</p>
      <h1>This page is out of reach</h1>
      <p className="vx-door-lead">
        The address may have changed. Return to your workspace to find your
        work.
      </p>
      <div className="vx-door-actions">
        <a className="vx-pill vx-pill--large" href={signedIn ? '/app' : '/signin'}>
          {signedIn ? 'Back to workspace' : 'Back to sign in'}
        </a>
      </div>
    </Door>;
}
function Root() {
  // The member's saved choice is server-rendered on <html>, so CSS alone picks the palette before first paint.
  const theme = useMatch({ from: "/app", shouldThrow: false })?.context?.operator?.theme;
  return (
    <html lang="en" data-theme={theme}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss(productConfig.theme) }} />
        <script dangerouslySetInnerHTML={{ __html: introGuardScript }} />
        <style>{introCss}</style>
        {fontLinks.map((link) => (
          <link key={link.href} {...link} />
        ))}
        <HeadContent />
      </head>
      <body>
        <div className="app-root">
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
