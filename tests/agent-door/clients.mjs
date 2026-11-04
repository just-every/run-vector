import surface from '../../agent-surface.json' with {type:'json'};

/** Mint a real scoped native client through the owner's existing Settings door. */
export default async function ({request,origin,cookie}) {
  const response=await request(new URL('/api/settings/integrations/tokens',origin).href,{
    method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},
    body:JSON.stringify({name:'Native read client',scopes:['issues:read','evidence:read','projects:read']}),
  });
  if(response.status!==201)throw new Error('Native client issuance failed');
  const issued=await response.json(),id=`vector-token:${issued.credential.id}`;
  if(typeof issued.token!=='string'||!issued.token.startsWith('int_'))throw new Error('Native credential missing');
  const headers={Origin:origin,Cookie:cookie,'Content-Type':'application/json'};
  const session=await request(new URL('/api/session',origin).href,{headers});
  if(session.status!==200)throw new Error('Native project sponsor unavailable');
  const {operatorId}=await session.json();
  const name='synthetic-vector-'+crypto.randomUUID();
  const created=await request(new URL('/api/settings/projects',origin).href,{
    method:'POST',headers,body:JSON.stringify({name,leadOperatorId:operatorId}),
  });
  if(created.status!==200)throw new Error('Native project fixture creation failed');
  const project=(await created.json()).projects.find(project=>project.name===name);
  if(!project)throw new Error('Native project fixture missing');
  return {values:{project:{id:project.id}},clients:{local:{token:issued.token,clientId:id,agent:{id,name:issued.credential.name,specialist:surface.specialist}}}};
}
