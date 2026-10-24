/** A real P-256 provider-edge fixture; its private key exists only for the test. */
export async function eventSigner(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
 const publicKey=base64(new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey)));
 return {publicKey,async sign(events:unknown,timestamp=String(Math.floor(Date.now()/1000))){
  const body=JSON.stringify(events),raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(timestamp+body)));
  const integer=(bytes:Uint8Array)=>{let first=0;while(first<bytes.length-1&&bytes[first]===0)first++;const value=Array.from(bytes.slice(first));if(value[0]&128)value.unshift(0);return [2,value.length,...value];};
  const integers=[...integer(raw.slice(0,32)),...integer(raw.slice(32))];
  return {body,headers:{'Content-Type':'application/json','X-Twilio-Email-Event-Webhook-Timestamp':timestamp,'X-Twilio-Email-Event-Webhook-Signature':base64(Uint8Array.from([48,integers.length,...integers]))}};
 }};
}
