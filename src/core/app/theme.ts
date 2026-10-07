import type { CSSProperties } from 'react'
import type { ProductTheme } from '../shared/product-config'

type ThemeStyle = CSSProperties & Record<`--${string}`, string>

export function themeStyle(theme: ProductTheme): ThemeStyle {
  return {
    '--color-accent': theme.accent,
    '--color-background': theme.background,
    '--color-foreground': theme.foreground,
    '--color-muted': theme.muted,
    '--color-panel': theme.panel,
  }
}
