import { z } from 'zod'
export const googleSettingsSchema = z.object({ configured:z.boolean(), clientId:z.string(), tested:z.boolean(), enabled:z.boolean(), redirectUri:z.string(), javascriptOrigin:z.string() })
