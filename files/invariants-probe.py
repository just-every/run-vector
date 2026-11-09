from pathlib import Path
import subprocess,re,json

def git(*args):return subprocess.check_output(['git',*args],text=True)
main=git('show','origin/main:CONTRACT.md'); tip=Path('CONTRACT.md').read_text()
pattern=r'^\| `([^`]+)` \| (.+?) \| ([^|]+?) \| (done|partial|missing) \|'
a={m[0]:(m[1],m[2],m[3]) for m in re.findall(pattern,main,re.M)}
b={m[0]:(m[1],m[2],m[3]) for m in re.findall(pattern,tip,re.M)}
assert a==b and len(a)==272
assert b['ROLE-011'][2]=='partial'
assert 'separate deliberate native member erasure flow remains owed to ROLE-012' in tip
s=Path('tests/worker/member-suspension.test.ts').read_text()
assert s.count('`vector-token:${token.credential.id}`')==2
assert "'vector-token:'+token.credential.id" not in s
for name in ['ACCEPTANCE.md','docs/CLAIMS.md','tests/worker/leadership-digest-upgrade.test.ts']:
 assert Path(name).read_bytes()==subprocess.check_output(['git','show','origin/main:'+name]),name
old=git('show','db865aaeaf9a5e327f8128664325d30d408310ed:tests/worker/member-suspension.test.ts')
assert s==old.replace("'vector-token:'+token.credential.id",'`vector-token:${token.credential.id}`')
rows={'clauses_before':len(a),'clauses_after':len(b),'statuses_before':{k:sum(v[2]==k for v in a.values()) for k in ['done','partial','missing']},'statuses_after':{k:sum(v[2]==k for v in b.values()) for k in ['done','partial','missing']},'status_changes':[],'assertions_preserved':True,'namespace_bindings_changed':2,'views_identical_to_main':True,'historical_fixture_identical_to_main':True}
Path('../packet/invariants.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows))
