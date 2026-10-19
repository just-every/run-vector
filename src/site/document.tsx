import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fontLinks } from '../core/app/fonts'
import { productConfig } from '../ext/config'
import { themeCss } from '../core/app/theme'

export function documentHtml(title: string, description: string, content: ReactNode, styles: string[]) {
  return '<!doctype html>' + renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.svg" />
        <style dangerouslySetInnerHTML={{ __html: themeCss(productConfig.theme) }} />
        {fontLinks.map(link => <link key={link.href} {...link} />)}
        {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
      </head>
      <body><div className="app-root">{content}</div></body>
    </html>,
  )
}
