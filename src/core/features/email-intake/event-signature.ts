/** SendGrid signs timestamp + exact raw body with P-256 ECDSA (ASN.1 DER signature). */
const bytes=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export async function importEventKey(value:string) {
  return crypto.subtle.importKey('spki',bytes(value),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
}
function signature(value:string) {
  const der=bytes(value);
  if(der.length<8||der[0]!==0x30||der[1]!==der.length-2)throw new Error('Invalid signature');
  const output=new Uint8Array(64);let cursor=2;
  for(let half=0;half<2;half++){
    if(der[cursor++]!==2)throw new Error('Invalid signature');
    const size=der[cursor++];let integer=der.slice(cursor,cursor+size);cursor+=size;
    if(!size||size>33||integer.length!==size||integer[0]&128)throw new Error('Invalid signature');
    if(integer[0]===0&&integer.length>1)integer=integer.slice(1);
    if(integer.length>32)throw new Error('Invalid signature');
    output.set(integer,half*32+32-integer.length);
  }
  if(cursor!==der.length)throw new Error('Invalid signature');return output;
}
export async function verifyEventSignature(key:string,signed:string,timestamp:string,body:string) {
  try{return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await importEventKey(key),signature(signed),new TextEncoder().encode(timestamp+body));}
  catch{return false;}
}
