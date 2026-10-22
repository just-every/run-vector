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
 return <div className="integration-receivers"><p>A receiver is an address another app gives you so Vector can send it issue changes. Choose one of these no-code options; their own plan or permissions may be required.</p>
 <details><summary>Zapier: receive changes with Catch Hook</summary><ol><li>In Zapier, choose <strong>Create → Zap</strong>. Click <strong>Trigger</strong>, search for <strong>Webhooks by Zapier</strong>, choose <strong>Catch Hook</strong>, then <strong>Continue</strong>. Webhooks require a paid Zapier plan.</li><li>Leave <strong>Pick off a Child Key</strong> empty. Continue, then copy <strong>Your webhook URL</strong>.</li><li>Below, enter a destination name such as “Zapier issue changes”, paste the copied URL into <strong>Public HTTPS destination</strong>, and choose <strong>Register destination</strong>. Zapier does not need the generated signing secret; close its credential panel.</li><li>Choose <strong>Send test</strong> beside your destination. Back in Zapier, click <strong>Test trigger</strong> and select the request whose event is <code>vector.test</code>.</li><li>Create or edit a real issue in Vector, then click <strong>Test trigger</strong> again in Zapier and select that issue event so its title and status fields are available. Add the action you want, such as a Slack message or spreadsheet row, map those fields, test the action, then <strong>Publish</strong> the Zap.</li></ol><a href="https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zap-workflows-from-webhooks" target="_blank" rel="noreferrer">Zapier’s webhook guide</a></details>
 <details><summary>Make: receive changes with a custom webhook</summary><ol><li>In Make, choose <strong>Create a new scenario</strong>. Click the plus, search for <strong>Webhooks</strong>, and choose <strong>Custom webhook</strong>.</li><li>Click <strong>Add</strong>, name it “Vector issue changes”, and <strong>Save</strong>. Copy the webhook address Make gives you. Leave API-key authentication off; Vector’s destination form does not send a Make API key.</li><li>Below, name the destination, paste that address into <strong>Public HTTPS destination</strong>, and choose <strong>Register destination</strong>. Make does not need the generated signing secret; close its credential panel.</li><li>Click <strong>Run once</strong> in Make, then <strong>Send test</strong> in Vector. Make’s webhook bubble should contain <code>event: vector.test</code>.</li><li>In Make’s webhook module choose <strong>Redetermine data structure</strong>, then create or edit a real issue in Vector so Make learns its title and status fields. Add the next module you want (for example, Slack → Create a Message), map those fields, and save the scenario. Turn scheduling on for immediate processing. Edit another issue and check the scenario’s History for the result.</li></ol><a href="https://help.make.com/webhooks" target="_blank" rel="noreferrer">Make’s webhook guide</a></details>
 <p>Enable delivery above before sending a test. “Accepted” confirms that the receiving app took the request; check that app for the action you set up. A status such as HTTP 200 is the receiver’s numbered reply; 200–299 means it accepted the request.</p>
 <details><summary>For developers: custom receivers and signature verification</summary><ol><li>Create a public HTTPS POST endpoint: an internet address that accepts data sent by Vector. Paste its URL below, without a username, password, ? parameters or # section.</li><li>Register the destination and store the signing secret privately. A signature proves the request came from Vector. Headers are extra request fields; Vector sends the event name, timestamp and signature there.</li><li>Verify and save the event, then reply with HTTP 200–299. Deduplication means remembering <code>webhook-id</code> and processing each ID only once, including when a request is repeated.</li><li>Send a test, then check your receiver for <code>vector.test</code>. Compare the delivery ID in the request’s <code>webhook-id</code> header with the result here.</li></ol><p>Delivery refuses private addresses, redirects and your hosting account’s domains. Use a separate receiving service. An uncertain result is not retried automatically: check the receiver before recording its result in Delivery history. HTTP 429 is retried a limited number of times.</p><CopyButton value={verifier} label="Copy receiver signature verifier"/><pre tabIndex={0}><code>{verifier}</code></pre></details></div>;
}
