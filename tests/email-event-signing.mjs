// Generated provider-edge keys only; no installation or provider credential.
export async function emailEventSigner() {
  const pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const key = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey))));
  return {key,async signed(events,timestamp=String(Math.floor(Date.now()/1000))) {
    const body=JSON.stringify(events),bytes=new TextEncoder().encode(timestamp+body);
    const raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,bytes));
    const integer=part=>{let value=Array.from(part);while(value.length>1&&value[0]===0)value.shift();if(value[0]&128)value.unshift(0);return [2,value.length,...value];};
    const parts=[...integer(raw.slice(0,32)),...integer(raw.slice(32))];
    return {body,headers:{'content-type':'application/json','X-Twilio-Email-Event-Webhook-Timestamp':timestamp,'X-Twilio-Email-Event-Webhook-Signature':btoa(String.fromCharCode(48,parts.length,...parts))}};
  }};
}
