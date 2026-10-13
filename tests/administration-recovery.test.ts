import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { contract } from './contract.ts'

contract('BASE-OPS-002 TEAM-001','administration upgrade supports disposable backup recovery and additive code rollback',()=>{
  const output=resolve('.artifacts/verification');mkdirSync(output,{recursive:true})
  const directory=mkdtempSync(join(output,'administration-recovery-')),path=join(directory,'database.sqlite'),backup=join(directory,'previous-head.sqlite')
  let db:DatabaseSync|undefined
  try {
    const migrations=readdirSync('migrations/core').filter(name=>name.endsWith('.sql')).sort()
    db=new DatabaseSync(path)
    for(const name of migrations.slice(0,12))db.exec(readFileSync(join('migrations/core',name),'utf8'))
    db.exec(`INSERT INTO workspace_settings VALUES('workspace','Recovery workspace','UTC','2026-01-01','2026-01-01');
      INSERT INTO operators VALUES('operator','workspace','Owner','owner@recovery.test',NULL,'2026-01-01','2026-01-01');
      INSERT INTO teams VALUES('team','workspace','Recovery team','REC',NULL,'2026-01-01','2026-01-01');
      INSERT INTO workflow_statuses VALUES('status','team','Backlog','backlog',0,'2026-01-01','2026-01-01');
      INSERT INTO team_issue_sequences VALUES('team',17,'2026-01-01');
      INSERT INTO issues(id,identifier,origin_prefix,sequence_number,team_id,title,status_id,priority,created_at,updated_at) VALUES('issue','REC-17','REC',17,'team','Retained issue','status','none','2026-01-01','2026-01-01');
      INSERT INTO audit_records VALUES('audit','operator','issue.changed','REC-17','issue','2026-01-01','2026-01-01');`)
    const snapshot=()=>Object.fromEntries((db!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[]).map(({name})=>[name,db!.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]))
    const before=snapshot()
    db.close();db=undefined;copyFileSync(path,backup)
    db=new DatabaseSync(path)
    const migration=readFileSync('migrations/core/0013_workspace_administration.sql','utf8');db.exec(migration)
    for(const [table,rows] of Object.entries(before))assert.deepEqual(db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all(),rows,table)
    db.exec("INSERT INTO teams VALUES('free','workspace','Fresh team','FREE',NULL,'2026-01-01','2026-01-01')")
    assert.throws(()=>db!.exec("UPDATE teams SET identifier_prefix='free' WHERE id='free'"),/invalid_team_prefix/)
    // Previous application SQL remains compatible while durable guards stay installed.
    db.exec("INSERT INTO audit_records VALUES('rollback-audit','operator','issue.changed','REC-17','issue','2026-01-02','2026-01-02')")
    assert.throws(()=>db!.exec("UPDATE teams SET identifier_prefix='NEW' WHERE id='team'"),/team_prefix_frozen/)
    db.close();db=undefined;copyFileSync(backup,path)
    db=new DatabaseSync(path)
    assert.deepEqual(snapshot(),before)
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='team_issue_history'").get(),undefined)
    db.exec(migration)
    assert.equal(db.prepare('SELECT count(*) n FROM team_issue_history').get()!.n,1)
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
  } finally { db?.close();rmSync(directory,{recursive:true,force:true}) }
})
