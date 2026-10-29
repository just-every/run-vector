/** A native person cannot erase data while unindexed agent custody may retain it. */
export default async function ({request,origin,cookie}) {
  const response=await request(new URL('/api/data/erasure/preview',origin).href,{
    method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},
    body:JSON.stringify({email:'retained-import-person@example.invalid'}),
  });
  const body=await response.json();
  if(response.status!==409||body.error!=='agent_custody_unavailable')throw new Error('Native retained-artifact custody was not held');
}
