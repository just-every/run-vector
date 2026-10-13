import {env} from 'cloudflare:workers'
import {applyD1Migrations} from 'cloudflare:test'
import {expect,inject,it} from 'vitest'
import {ensureSampleData} from '../../src/core/features/sample-data/service'
import {populateUpgradeHistory,historySnapshot,tableSnapshot} from './upgrade-history'
it('[BASE-OPS-002 BASE-DATA-001] populated 0019→0020→0021 transitions each retain native histories and terminal mail custody',async()=>{
 const migrations=inject('migrations');await applyD1Migrations(env.DB,migrations.slice(0,19));await ensureSampleData(env.DB,new Date('2026-10-01T00:00:00Z'));await populateUpgradeHistory();
 for(const previous of [19,20]) {
  const retired=previous===20?['local_mail_outbox','notification_development_mail']:[],before=await historySnapshot(retired);
  expect(migrations[previous].name).toBe(previous===19?'0020_development_outbox.sql':'0021_development_mail_custody.sql');
  await applyD1Migrations(env.DB,[migrations[previous]]);await applyD1Migrations(env.DB,[migrations[previous]]);
  for(const table of before)expect(await tableSnapshot(table.name),table.name).toEqual(table.rows);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first('n')).toBe(previous===19?0:1);
  if(previous===19) await env.DB.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind('previous-head-capture',Date.now(),JSON.stringify({to:['historical@upgrade.test'],subject:'Retained previous-head capture',text:'Historical local message',deliveryId:'prior-local-message'})).run();
  for(const table of retired)expect(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first()).toBeNull();
 }
});
