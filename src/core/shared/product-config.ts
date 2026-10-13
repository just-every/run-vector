export type ProductTheme = {
  accent: string
  background: string
  foreground: string
  muted: string
  panel: string
}

export type ProductConfig = {
  productName: string
  showPoweredByCredit: boolean
  theme: ProductTheme
}
