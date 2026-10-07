// Buyer-owned product configuration. Change these values to personalise the deployment.
// Example: set ownerName to "Acme Operations" and ownerStatement to "Decisions and delivery for Acme.".
import type { ProductConfig } from '../core/shared/product-config'

export const productConfig = {
  ownerName: 'Vector',
  ownerStatement: 'Current work, clearly decided.',
  productName: 'Vector',
  showPoweredByCredit: true,
  theme: {
    accent: '#a98bff',
    background: '#0a0d14',
    foreground: '#f3ede8',
    muted: '#aaa6b9',
    panel: '#161724',
  },
} satisfies ProductConfig
