/** A native person cannot erase data while unindexed agent custody may retain it. */
export default async function ({request,origin,cookie,tool}) {
  const metadata=await tool('vector.ops.workspace_access',{});
  const created=await tool('vector.issue.creation',{
    teamId:metadata.result.structuredContent.teams[0].id,
    title:'synthetic-vector-3304',idempotency_key:crypto.randomUUID(),
  });
  const record=created.result?.structuredContent;
  const link=created.result?.content?.find(item=>item.type==='resource_link');
  if(created.result?.isError||!record?.id||link?.uri!==`vector://issue/${record.id}`||link?.name!==record.identifier)throw new Error('Native issue write did not return its named resource link');
  const response=await request(new URL('/api/data/erasure/preview',origin).href,{
    method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},
    body:JSON.stringify({email:'retained-import-person@example.invalid'}),
  });
  const body=await response.json();
  if(response.status!==409||body.error!=='agent_custody_unavailable')throw new Error('Native retained-artifact custody was not held');
}
