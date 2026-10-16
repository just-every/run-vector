import {CopyButton} from './copy-field';
const verifier=`// Node.js 22+. Call this with your incoming standard Request.
// Save the generated secret as VECTOR_WEBHOOK_SECRET in the receiver's environment.
import {createHmac, timingSafeEqual} from 'node:crypto';
export async function verifyVectorWebhook(request) {
  const raw = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(await request.arrayBuffer());
  const h = request.headers;
  const id = h.get('webhook-id');
  const tenant = h.get('webhook-tenant');
  const destination = h.get('webhook-destination');
  const event = h.get('webhook-event');
  const timestamp = h.get('webhook-timestamp');
  const signature = h.get('webhook-signature');
  if (!id || !tenant || !destination || !event || !/^\\d{1,12}$/.test(timestamp ?? '') ||
      Math.abs(Date.now() - Number(timestamp) * 1000) > 300000 ||
      !/^v1=[a-f0-9]{64}$/.test(signature ?? '')) throw new Error('Invalid webhook');
  const secret = process.env.VECTOR_WEBHOOK_SECRET;
  if (!/^[a-f0-9]{64}$/.test(secret ?? '')) throw new Error('Configure VECTOR_WEBHOOK_SECRET');
  const signed = JSON.stringify(['integrations.webhook.v1', tenant, destination, event, id, timestamp, raw]);
  const expected = createHmac('sha256', Buffer.from(secret, 'hex')).update(signed).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(3), 'hex'))) throw new Error('Invalid signature');
  return {id, tenant, destination, event, payload:JSON.parse(raw)};
}
// In your route: verify, save the event durably with a UNIQUE id, then return HTTP 200.
// A duplicate id must return 200 without processing it again.
// Return 401 if verification fails; never acknowledge an event before saving it.`;
export function DestinationSetup(){
 return <details><summary>Set up your receiver and verify delivery</summary><ol><li>Create a public HTTPS POST endpoint in your receiving service, or use its custom webhook receiver. Paste that exact URL into Public HTTPS destination. The address cannot contain a username, password, ? parameters or # section.</li><li>Register the destination and save the generated signing secret in the receiving service’s secret store. Vector sends JSON with <code>webhook-id</code>, <code>webhook-event</code>, <code>webhook-timestamp</code> and signature headers. The verifier below checks the signature for you.</li><li>Your receiver should verify and save the event, then return HTTP 200–299. Deduplicate by <code>webhook-id</code>. Do not return success before the event is saved.</li><li>Enable delivery above, then choose <strong>Send test</strong> for this destination. Check the receiver for <code>vector.test</code> and compare its delivery ID with the result on this page.</li><li>Create or edit an issue to receive real issue events. Accepted means the receiver acknowledged the request; check your receiving service for the downstream result.</li></ol><p>Delivery refuses private addresses, redirects and your hosting account’s domains. Use a separate receiving service. An uncertain result is not retried automatically: check the receiver before reconciling it in Delivery history. HTTP 429 is retried with a finite backoff.</p><CopyButton value={verifier} label="Copy receiver signature verifier"/><pre><code>{verifier}</code></pre></details>;
}
