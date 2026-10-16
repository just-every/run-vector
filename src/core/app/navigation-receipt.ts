import { z } from 'zod'

export const navigationPageSchema = z.object({
  id: z.string(), name: z.string(), editorConfigured: z.boolean(),
  resources: z.record(z.string(), z.json()),
})
type Page = z.output<typeof navigationPageSchema>
let pending: { href: string; page: Page } | null = null

/** Transfer a fresh projection to its immediate, equivalent navigation. */
export function offerNavigationReceipt(href: string, page: Page) {
  const receipt = { href, page }
  pending = receipt
  return () => { if (pending === receipt) pending = null }
}
export function takeNavigationReceipt(href: string): Page | null {
  if (typeof window === 'undefined') return null
  const receipt = pending
  pending = null
  return receipt?.href === href ? receipt.page : null
}
