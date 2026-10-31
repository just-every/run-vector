import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { expect, inject } from 'vitest';
import { insertHistoricalSample } from './historical-sample-fixture';

/** A populated pre-subscription installation retains its destination and queue. */
export async function outboundSubscriptionUpgrade() {
  const db = env.ARCHIVE_TARGET_DB, migrations = inject('migrations');
  const boundary = migrations.findIndex(m => m.name === '0119_webhook_subscriptions.sql');
  await applyD1Migrations(db, migrations.slice(0, boundary));
  await insertHistoricalSample(db, new Date('2026-10-01T00:00:00Z'));
  const issue = (await db.prepare('SELECT i.id,i.identifier,i.team_id,t.workspace_id FROM issues i JOIN teams t ON t.id=i.team_id LIMIT 1').first<any>())!;
  const owner = (await db.prepare('SELECT id FROM operators WHERE workspace_id=? LIMIT 1').bind(issue.workspace_id).first<string>('id'))!;
  const at = '2026-10-01T00:00:00.000Z', destination = 'synthetic-vector-9050';
  await db.prepare('INSERT INTO vector_webhook_destinations(id,workspace_id,name,url,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .bind(destination, issue.workspace_id, 'synthetic-vector-9051', 'https://receiver.example.com/upgrade', at, at).run();
  const activity = (id: string, kind: string, comment?: string) => db.prepare('INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .bind(id, issue.id, owner, kind, JSON.stringify(comment ? { id: comment } : {}), at, at);
  await activity('synthetic-vector-9052', 'issue.created').run();
  const original = await db.prepare('SELECT * FROM vector_webhook_destinations WHERE id=?').bind(destination).first();
  const queued = (await db.prepare('SELECT * FROM vector_webhook_events ORDER BY id').all()).results;
  expect(queued).toHaveLength(1);
  const issues = (await db.prepare('SELECT * FROM issues ORDER BY id').all()).results;
  await applyD1Migrations(db, migrations.slice(boundary));
  expect(await db.prepare('SELECT * FROM vector_webhook_destinations WHERE id=?').bind(destination).first()).toEqual({ ...original,
    event_kinds: JSON.stringify(['issue.created', 'issue.updated', 'issue.completed']), team_ids: '[]' });
  expect((await db.prepare('SELECT * FROM vector_webhook_events ORDER BY id').all()).results).toEqual(queued);
  expect((await db.prepare('SELECT * FROM issues ORDER BY id').all()).results).toEqual(issues);
  await db.batch([
    db.prepare('INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('synthetic-vector-9053', issue.id, owner, 'synthetic-vector-9054', at, at),
    activity('synthetic-vector-9055', 'comment.created', 'synthetic-vector-9053'),
  ]);
  expect(await db.prepare("SELECT count(*) n FROM vector_webhook_events WHERE event LIKE 'comment.%'").first<number>('n')).toBe(0);
  await db.prepare('UPDATE vector_webhook_destinations SET event_kinds=?,team_ids=? WHERE id=?')
    .bind('["comment.created"]', JSON.stringify([issue.team_id]), destination).run();
  await db.batch([
    db.prepare('INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,parent_comment_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('synthetic-vector-9056', issue.id, owner, 'synthetic-vector-9057', 'synthetic-vector-9053', at, at),
    activity('synthetic-vector-9058', 'comment.created', 'synthetic-vector-9056'),
  ]);
  const event = await db.prepare("SELECT body FROM vector_webhook_events WHERE event='comment.created'").first<string>('body');
  expect(JSON.parse(event!)).toMatchObject({ commentId: 'synthetic-vector-9056', rootCommentId: 'synthetic-vector-9053', parentCommentId: 'synthetic-vector-9053', issueId: issue.id });
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
