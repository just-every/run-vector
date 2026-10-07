// Provider protocol fixtures are test-only and never exported by the public module.
export function fixtureMessage() {
  return { deliveryId: 'worker-command-1', from: 'Sender <sender@example.com>', to: ['reader@example.net'], cc: ['copy@example.net'], bcc: ['blind@example.net'], replyTo: 'replies@example.com',
    subject: 'Unicode ✓', text: 'Plain body', html: '<p>HTML body</p>',
    headers: { 'Message-ID': '<new@example.com>', 'In-Reply-To': '<parent@example.com>', References: '<first@example.com> <parent@example.com>' },
    attachments: [{ filename: 'bytes.bin', contentType: 'application/octet-stream', content: Uint8Array.of(0, 255, 128, 10), disposition: 'attachment' }],
    unsubscribe: { url: 'https://example.com/unsubscribe?id=1', oneClick: true },
  };
}
export function fixtureResponse(provider, scenario) {
  if (scenario === 'network') throw new Error('TEST SECRET must never escape');
  if (/^http-\d+$/.test(scenario)) return new Response('TEST SECRET provider body', { status: Number(scenario.slice(5)) });
  if (scenario === 'malformed') return new Response('{invalid', { status: 200 });
  if (provider === 'sendgrid') return new Response(null, { status: 202, headers: scenario === 'missing-id' ? {} : { 'x-message-id': 'sg-worker-receipt' } });
  if (provider === 'resend') return Response.json(scenario === 'missing-id' ? {} : { id: 'resend-worker-receipt' });
  if (scenario === 'false-success') return Response.json({ success: false, errors: [{ code: 10001, message: 'TEST SECRET' }], result: null });
  return Response.json({ success: true, errors: [], messages: [], result: {
    message_id: 'cf-worker-receipt', delivered: ['reader@example.net'],
    queued: scenario === 'partial' ? ['copy@example.net'] : ['copy@example.net', 'blind@example.net'],
    permanent_bounces: scenario === 'partial' ? ['blind@example.net'] : [], suppressed_recipients: [],
  } });
}
