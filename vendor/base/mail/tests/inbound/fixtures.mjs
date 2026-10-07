const encoder = new TextEncoder();
export const attachment = new Uint8Array([0, 1, 127, 128, 200, 255]);
export const plain = 'Hello café ☕';
export const rich = '<p>Hello café ☕</p><img src="cid:logo">';
export const limits = { maxRawBytes: 100_000, maxBodyBytes: 10_000, maxAttachments: 5, maxAttachmentBytes: 100, maxTotalAttachmentBytes: 200 };
export const thread = 'Message-ID: <new@example.test>\r\nIn-Reply-To: <parent@example.test>\r\nReferences: <first@example.test>\r\n\t<parent@example.test>';
export function mimeFixture() {
  const body = [
    'From: =?UTF-8?Q?Jos=C3=A9?= <sender@example.test>', 'To: Receiver <receiver@example.test>',
    'Subject: =?UTF-8?B?Q2Fmw6k=?=', thread, 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="mixed+1"', '',
    'preamble', '--mixed+1', 'Content-Type: multipart/alternative; boundary=alternative', '',
    '--alternative', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '', 'Hello caf=C3=A9 =E2=98=95',
    '--alternative', 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', btoa(String.fromCharCode(...encoder.encode(rich))),
    '--alternative--', '--mixed+1', 'Content-Type: image/png', "Content-Disposition: inline; filename*=utf-8''caf%C3%A9.png", 'Content-ID: <logo>', 'Content-Transfer-Encoding: base64', '', 'AAF/gMj/', '--mixed+1--', 'epilogue',
  ].join('\r\n');
  return encoder.encode(body);
}
export function cloudflare(raw = mimeFixture(), claimed = raw.length) {
  return { provider: 'cloudflare', message: { from: 'sender@example.test', to: 'receiver@example.test', headers: new Headers(), rawSize: claimed,
    raw: new ReadableStream({ start(controller) { for (let i = 0; i < raw.length; i += 17) controller.enqueue(raw.slice(i, i + 17)); controller.close(); } }) } };
}
export function form(fields, files = []) {
  const chunks = [];
  for (const [name, content] of fields) chunks.push(encoder.encode(`--form-boundary\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`), typeof content === 'string' ? encoder.encode(content) : content, encoder.encode('\r\n'));
  for (const file of files) chunks.push(encoder.encode(`--form-boundary\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`), file.content, encoder.encode('\r\n'));
  chunks.push(encoder.encode('--form-boundary--\r\n'));
  const rawBody = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0)); let offset = 0;
  for (const chunk of chunks) { rawBody.set(chunk, offset); offset += chunk.length; }
  return { provider: 'sendgrid', rawBody, contentType: 'multipart/form-data; boundary="form-boundary"' };
}
export function sendgrid(extra = []) {
  return form([['from', 'José <sender@example.test>'], ['to', 'Receiver <receiver@example.test>'], ['subject', 'Café'], ['headers', thread], ['text', plain], ['html', rich], ['attachments', '1'],
    ['attachment-info', JSON.stringify({ attachment1: { filename: 'café.png', type: 'image/png', 'content-id': 'logo' } })], ['content-ids', '{"logo":"attachment1"}'], ...extra],
    [{ name: 'attachment1', filename: 'café.png', type: 'image/png', content: attachment }]);
}
export function resend(overrides = {}) {
  return { provider: 'resend', signedEmailId: 'email-1', email: { id: 'email-1', from: 'José <sender@example.test>', to: ['receiver@example.test'], subject: 'Café', text: plain, html: rich,
    message_id: '<new@example.test>', headers: { 'in-reply-to': '<parent@example.test>', references: '<first@example.test>\r\n\t<parent@example.test>' },
    attachments: [{ id: 'attachment-1', filename: 'café.png', content_type: 'image/png', content_disposition: 'inline', content_id: 'logo', size: attachment.length }] },
    fetchAttachment: async () => attachment, ...overrides };
}
export const expected = { messageId: '<new@example.test>', from: 'sender@example.test', to: ['receiver@example.test'], subject: 'Café', text: plain, html: rich,
  inReplyTo: '<parent@example.test>', references: ['<first@example.test>', '<parent@example.test>'], attachments: [{ filename: 'café.png', contentType: 'image/png', content: attachment, contentId: 'logo' }] };
