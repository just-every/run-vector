import argparse, hashlib, hmac, json, re, sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--observed',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--revision',required=True);a=p.parse_args()
states=sorted((a.repo/'.wrangler/vector-e2e/runs').glob('*'))
if not states:raise SystemExit('No runtime state')
files=[p for p in (states[-1]/'v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if re.fullmatch('[a-f0-9]{64}\\.sqlite',p.name)]
if len(files)!=1:raise SystemExit('Expected one runtime D1')
db=sqlite3.connect(f'file:{files[0]}?mode=ro',uri=True);db.row_factory=sqlite3.Row
secret=b'synthetic-fixture-native-runtime-secret-with-at-least-32-characters'
def digest(purpose,value):return hmac.new(secret,(purpose+'\0'+value).encode(),hashlib.sha256).hexdigest()
limits={r['key']:dict(r) for r in db.execute('SELECT key,window,count FROM oa_limits')}
# Local harness mail is consulted only in memory to identify the native token
# bucket. Never export a message, link, token, digest, session or address.
token_rates={}
for row in db.execute('SELECT message FROM rer_mail_development_outbox'):
 try:
  from urllib.parse import urlsplit,parse_qs
  message=json.loads(row[0]);match=re.search(r'https?://[^\s]+',message.get('text',''))
  if not match:continue
  token=parse_qs(urlsplit(match[0]).query).get('token',[None])[0]
  if token:token_rates[digest('link',token)]=digest('rate','confirmation:email:'+token[:128])
 except (ValueError,KeyError,TypeError):pass
events=[]
for table,kind in (('oa_tokens',None),('oa_step_up_challenges','step-up')):
 for row in db.execute('SELECT token_hash,consumed_at'+(',kind' if kind is None else '')+' FROM '+table+' WHERE consumed_at IS NOT NULL'):
  rate=limits.get(token_rates.get(row['token_hash'],''))
  events.append({'at':row['consumed_at'],'status':303,'kind':row['kind'] if kind is None else kind,'nativeTokenBucket':{'window':rate['window'],'count':rate['count']} if rate else None,'evidence':'native consumed_at'})
observed=[json.loads(l) for l in a.observed.read_text().splitlines()] if a.observed.exists() else []
for row in observed:
 if row['status']!=303:
  events.append({'at':row['at'],'status':row['status'],'kind':'refused confirmation','nativeTokenBucket':row['tokenBucket'],'evidence':'browser/public HTTP response','observedIp':row['ip']})
events.sort(key=lambda r:r['at']);fixed={}
for i,row in enumerate(events):
 row['request']=i+1;row['tokenAlias']=i+1 if row['status']==303 else None
 row['fixedWindow']=row['at']//900000
 fixed[row['fixedWindow']]=fixed.get(row['fixedWindow'],0)+1;row['ipFixedWindowCount']=fixed[row['fixedWindow']]
 row['ipRollingMinute']=sum(e['at']>row['at']-60000 for e in events[:i+1])
# Every successful lifecycle consumes one distinct link/challenge. Its token
# count comes from the actual oa_limits row; refusals have their observed count.
ip=limits.get(digest('rate','confirmation:ip:loopback'))
actual={'window':ip['window'],'count':ip['count']} if ip else None
known=fixed.get(ip['window'],0) if ip else 0
out={'revision':a.revision,'group':'current','ipSubject':'confirmation:ip:loopback','tokenSubject':'confirmation:email:<one token>','limits':{'ip':30,'token':5,'fixedWindowSeconds':900},'method':'All successful confirmations reconstructed from native consumed_at ledgers; refused POSTs from instrumented HTTP responses; per-token counters read from native oa_limits without exporting identities or credentials. This covers reader contexts outside the primary browser context.','snapshotMatched':actual is not None and known==actual['count'],'nativeCurrentIpBucket':actual,'reconstructedCurrentIpCount':known,'events':events,'summary':{'requests':len(events),'successful':sum(r['status']==303 for r in events),'refused':sum(r['status']!=303 for r in events),'fixedWindows':[{'window':w,'requests':n} for w,n in sorted(fixed.items())],'peakRollingMinute':max([r['ipRollingMinute'] for r in events],default=0),'peakTokenCount':max([r['nativeTokenBucket']['count'] for r in events if r['nativeTokenBucket']],default=0)}}
a.output.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k] for k in ('revision','snapshotMatched','nativeCurrentIpBucket','summary')}))
db.close()
