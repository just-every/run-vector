import { z } from 'zod';
import { notificationKinds } from './schema';

// Project updates currently qualify native Inbox delivery only.
export const channelKinds = notificationKinds.filter(kind => kind !== 'project_update');

export const emailModes = ['off', 'immediate', 'hourly', 'daily'] as const;
export type EmailMode = typeof emailModes[number];
export const channelChoiceSchema = z.object({
  kind: z.enum(channelKinds), emailMode: z.enum(emailModes), slack: z.boolean(),
}).strict();
export type ChannelChoice = z.infer<typeof channelChoiceSchema>;
const uniqueKinds = (rows: {kind: string}[]) => new Set(rows.map(row => row.kind)).size === rows.length;
export const channelPreferencesInputSchema = z.object({channels: z.array(z.union([
  channelChoiceSchema, z.object({kind: z.enum(channelKinds), inherit: z.literal(true)}).strict(),
])).max(channelKinds.length).refine(uniqueKinds)}).strict();
export const channelDefaultsInputSchema = z.object({channels: z.array(channelChoiceSchema)
  .max(channelKinds.length).refine(uniqueKinds)}).strict();
export type ChannelPreferences = {
  channels: (ChannelChoice & {inherited: boolean})[];
  defaults: ChannelChoice[];
  canManageDefaults: boolean;
  digestDeliveries: {id: string; status: 'failed'|'uncertain'; attempts: number; updatedAt: string; reason: string|null}[];
};
