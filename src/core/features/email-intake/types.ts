export type IntakeSettings = {
  team_id: string; enabled: number; address: string; allowed_senders_json: string;
  acknowledgement: number; actor_operator_id: string | null; revision: number;
};
export type IntakeMessage = {
  id: string; team_id: string; message_key: string; message_id: string | null;
  issue_id: string | null; comment_id: string | null; root_id: string | null;
  sender: string | null; requester_domain: string | null; subject: string | null;
  text_body: string | null; html_body: string | null; cc_json: string;
  references_json: string; status: string; error: string | null; created_at: string;
};
export type InboundMail = {
  messageId: string | null; from: string; to: string[]; subject: string;
  text: string | null; html: string | null; inReplyTo: string | null; references: string[];
  attachments: { filename: string; contentType: string; content: Uint8Array; contentId: string | null }[];
};
export type CloudflareIntakeMessage = {
  from: string; to: string; headers: Headers; raw: ReadableStream<Uint8Array>;
  rawSize: number; setReject(reason: string): void;
};
export type Delivery = {
  id: string; issue_id: string; comment_id: string | null; root_id: string;
  message_id: string; kind: 'reply' | 'acknowledgement'; status: string;
  error: string | null; created_at: string;
};
