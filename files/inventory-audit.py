import hashlib,json,subprocess
from pathlib import Path
original='1a454502b9af6b959adccb8d55010f3dbcbb36f4'
def data(ref,path): return subprocess.check_output(['git','show',f'{ref}:{path}'])
def js(ref,path): return json.loads(data(ref,path))
path='management/integration/deployment-spec.json'
parents={ref:js(ref,path) for ref in (original,'origin/main')}
actual=json.loads(Path(path).read_text());emitted=json.loads(Path('dist/server/wrangler.json').read_text())
assert actual['durableObjects']==[dict(binding=x['name'],className=x['class_name']) for x in emitted['durable_objects']['bindings']]
assert actual['durableObjectMigrations']==[dict(tag=x['tag'],newSqliteClasses=x['new_sqlite_classes']) for x in emitted['migrations']]
for ref,parent in parents.items():
 for key,value in parent.items():
  if key not in ('durableObjects','durableObjectMigrations'): assert actual[key]==value,(ref,key)
 for key in ('resources','migrations','durableObjects','durableObjectMigrations'):
  assert all(x in actual[key] for x in parent[key]),(ref,key)
for m in actual['migrations']:
 raw=Path('migrations/core',m['name']).read_bytes()
 assert raw.decode()==m['sql']
 assert hashlib.sha256(raw).hexdigest()==m['sha256']
 assert raw==data(original,'migrations/core/'+m['name'])
 assert raw==data('origin/main','migrations/core/'+m['name'])
protected=['src','tests','migrations','wrangler.jsonc','package.json','pnpm-lock.yaml','.github','CONTRACT.md','ACCEPTANCE.md','docs/CLAIMS.md']
assert not subprocess.check_output(['git','diff',original,'--',*protected]),'protected source diff'
source=Path('CONTRACT.md').read_text()
sync_lines=[x for x in source.splitlines() if x.startswith('- **SYNC-001') or x.startswith('| `SYNC-001`')]
assert len(sync_lines)==2
original_lines=[x for x in data(original,'CONTRACT.md').decode().splitlines() if x.startswith('- **SYNC-001') or x.startswith('| `SYNC-001`')]
assert sync_lines==original_lines
assert '*Status:* partial' in sync_lines[0] and '| partial |' in sync_lines[1]
counts=[x for x in source.splitlines() if x.startswith(('| Published |','| Target and push further |','| All |'))]
changes=subprocess.check_output(['git','diff','--name-only',original],text=True).splitlines()
assert set(changes)<=set([path,'sources.lock.json']),changes
row=dict(original=original,main=subprocess.check_output(['git','rev-parse','origin/main'],text=True).strip(),changed_paths=changes,all_parent_inventory_retained=True,sql_bytes_match_both_parents=True,protected_source_diff=[],sync_001_status='partial',sync_001_unchanged=True,counts=counts)
for name,spec in [('before',parents[original]),('after',actual)]:
 row[name]=dict(resources=spec['resources'],durableObjects=spec['durableObjects'],durableObjectMigrations=spec['durableObjectMigrations'],sql_migration_count=len(spec['migrations']),sql_migrations=[dict(name=x['name'],sha256=x['sha256']) for x in spec['migrations']])
Path('../packet/inventory-audit.json').write_text(json.dumps(row,sort_keys=True,indent=2)+'\n')
print(json.dumps({k:v for k,v in row.items() if k not in ('before','after')},sort_keys=True))
print('Before: DO bindings='+str(len(row['before']['durableObjects']))+' DO migrations='+str(len(row['before']['durableObjectMigrations']))+' SQL='+str(row['before']['sql_migration_count']))
print('After: DO bindings='+str(len(row['after']['durableObjects']))+' DO migrations='+str(len(row['after']['durableObjectMigrations']))+' SQL='+str(row['after']['sql_migration_count']))
