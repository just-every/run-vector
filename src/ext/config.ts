// Buyer-owned product configuration. Change these values to personalise the deployment.
import type { ProductConfig } from '../core/shared/product-config'

export const productConfig = {
  productName: 'Vector',
  showPoweredByCredit: true,
  theme: {
    light: {
      accent: '#2446dc',
      background: '#f4f0e6',
      foreground: '#171a20',
      muted: '#5d6067',
      panel: '#fbf9f3',
    },
    dark: {
      accent: '#8ea4ff',
      background: '#15171c',
      foreground: '#eceae4',
      muted: '#a6a59f',
      panel: '#1c1f25',
    },
  },
} satisfies ProductConfig
