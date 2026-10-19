export type ProductPalette = {
  accent: string
  background: string
  foreground: string
  muted: string
  panel: string
}

/** The light palette dresses the public site and signed-out pages; the dark one is a member's Dark or System choice. */
export type ProductTheme = {
  light: ProductPalette
  dark: ProductPalette
}

export type ProductConfig = {
  productName: string
  showPoweredByCredit: boolean
  theme: ProductTheme
}
