import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { productConfig } from '../core/app/config'
import { themeStyle } from '../core/app/theme'
import '../core/app/app.css'
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Vector' },
      {
        name: 'description',
        content: 'An owned workspace for evidence and work.',
      },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <main className="app-state">
      <h1>Page not found</h1>
      <a href="/">Return to welcome</a>
    </main>
  ),
})
function Root() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="app-root" style={themeStyle(productConfig.theme)}>
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  )
}
