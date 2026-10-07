export type ProductTheme = {
  accent: string
  background: string
  foreground: string
  muted: string
  panel: string
}

export type ProductConfig = {
  ownerName: string
  ownerStatement: string
  productName: string
  showPoweredByCredit: boolean
  theme: ProductTheme
}
