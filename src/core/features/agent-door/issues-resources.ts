import { z } from 'zod';
import { ToolRefusal, type Person, type ResourceDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { requireIssueAccess } from '../issues/access';
import { readDescriptionHistory } from '../description-history/repository';
import { readSubissues } from '../subissues/projection';
import { readSourceIssueReferences } from '../issue-references/repository';
import { readIssueReactions } from '../reactions/service';
import { discussionView } from './issues-discussion.ts';
import { identifier, nativeRead } from './reads.ts';

export function vectorIssueResources(env: WorkerBindings): ResourceDefinition[] {
  const resource = (path: string, name: string, read: (db: D1Database, person: Person, key: string) => Promise<unknown>): ResourceDefinition => ({
    uriTemplate: `vector://issues/{identifier}/${path}`, name, scope: 'issues:read', classes: ['standard'],
    classify: record => [{ class: 'standard', facts: { measure: record.json == null ? 0 : 1 } }],
    async read(uri, ctx) {
      try {
        const key = identifier.parse(decodeURIComponent(uri.split('/')[3]));
        return { json: await nativeRead(env, ctx.person, db => read(db, ctx.person, key)), untrusted: true };
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof ToolRefusal && ['not_found', 'forbidden'].includes(error.code)) return null;
        throw error;
      }
    },
  });
  return [
    resource('discussion', 'Issue discussion, attachment metadata and links', discussionView),
    resource('description-history', 'Issue description history', (db, person, key) => readDescriptionHistory(db, key, person.id)),
    resource('subissues', 'Issue children and completion progress', (db, person, key) => readSubissues(db, key, person.id)),
    resource('references', 'Visible issue references', async (db, person, key) => {
      const issue = await requireIssueAccess(db, key, person.id); return { references: await readSourceIssueReferences(db, person.id, issue.id) };
    }),
    resource('reactions', 'Issue and comment reactions', async (db, person, key) => {
      const issue = await requireIssueAccess(db, key, person.id); return readIssueReactions(db, issue.id, person.id);
    }),
  ];
}
