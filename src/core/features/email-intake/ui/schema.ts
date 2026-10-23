import { z } from "zod";

export const emailSettingsSchema = z.object({
  settings: z.object({
    enabled: z.boolean(),
    address: z.string(),
    allowedSenders: z.array(z.string()),
    acknowledgement: z.boolean(),
  }),
  receipts: z.array(z.object({
    id: z.string(), messageId: z.string(), status: z.string(),
    error: z.string().nullable(), issueIdentifier: z.string().nullable(), createdAt: z.string(),
  })),
  eventsConfigured: z.boolean(),
  provider: z.literal("cloudflare"),
  ingressConfigured: z.boolean(),
  customerMappingAvailable: z.literal(false),
});

export const issueEmailSchema = z.object({
  thread: z.object({
    requester: z.string(), requesterDomain: z.string(), subject: z.string(),
    cc: z.array(z.string()), messageId: z.string(),
  }).nullable(),
  canReply: z.boolean(),
  deliveries: z.array(z.object({
    commentId: z.string().nullable(), kind: z.string(), status: z.string(), error: z.string().nullable(), createdAt: z.string(),
  })),
  messages: z.array(z.object({
    id: z.string(), commentId: z.string().nullable(), sender: z.string(), subject: z.string(),
    text: z.string(), html: z.string().nullable(),
    attachments: z.array(z.object({
      fileId: z.string(), contentId: z.string().nullable(), filename: z.string(), contentType: z.string(),
    })),
    createdAt: z.string(),
  })),
  customerMappingAvailable: z.literal(false),
});

export type IssueEmail = z.output<typeof issueEmailSchema>;
export const emailReplySchema = z.object({ commentId: z.string().nullable(), kind: z.string(), status: z.string(), error: z.string().nullable().optional() });
