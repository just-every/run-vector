import surface from '../../agent-surface.json' with {type:'json'};

/** Mint a real scoped native client through the owner's existing Settings door. */
export default async function ({request,origin,cookie}) {
  const response=await request(new URL('/api/settings/integrations/tokens',origin).href,{
    method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},
    body:JSON.stringify({name:'Native read client',scopes:['issues:read','evidence:read']}),
  });
  if(response.status!==201)throw new Error('Native client issuance failed');
  const issued=await response.json(),id=`vector-token:${issued.credential.id}`;
  if(typeof issued.token!=='string'||!issued.token.startsWith('int_'))throw new Error('Native credential missing');
  return {clients:{local:{token:issued.token,clientId:id,agent:{id,name:issued.credential.name,specialist:surface.specialist}}}};
}
