import { editorLeaf } from '../core/editor/leaf';
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Door } from "../core/app/site/door/door";
import { productConfig } from "../core/app/config";
import { themeStyle } from "../core/app/theme";
import "../core/app/app.css";
import { fontLinks } from "../core/app/fonts";
import { introCss, introGuardScript } from "../base/hydration/intro-guard";
export const Route = createRootRoute({
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
  notFoundComponent: editorLeaf(() => (
    <Door signIn>
      <p className="vx-door-kicker">404 · Page not found</p>
      <h1>This page is out of reach</h1>
      <p className="vx-door-lead">
        The address may have changed. Return to your workspace to find your
        work.
      </p>
      <div className="vx-door-actions">
        <a className="vx-pill vx-pill--large" href="/app">
          Back to workspace
        </a>
        <a href="/">Return to welcome</a>
      </div>
    </Door>
  )),
});
function Root() {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: introGuardScript }} />
        <style>{introCss}</style>
        {fontLinks.map((link) => (
          <link key={link.href} {...link} />
        ))}
        <HeadContent />
      </head>
      <body>
        <div className="app-root" style={themeStyle(productConfig.theme)}>
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
