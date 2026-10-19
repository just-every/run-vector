import type { ProductPalette, ProductTheme } from '../shared/product-config'

const declarations = (palette: ProductPalette) =>
  `--color-accent:${palette.accent};--color-background:${palette.background};--color-foreground:${palette.foreground};` +
  `--color-muted:${palette.muted};--color-panel:${palette.panel};`

/** Head CSS for the installation palette. Only the signed-in app sets data-theme, so every other page keeps light. */
export function themeCss(theme: ProductTheme) {
  const dark = declarations(theme.dark)
  return `:root{${declarations(theme.light)}}:root[data-theme="dark"]{${dark}}` +
    `@media (prefers-color-scheme: dark){:root[data-theme="system"]{${dark}}}`
}
