import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../../app/bindings';
import {readRequestJson} from '../../../app/input';
import {IntegrationError} from '../../integrations/errors';
import {generateReleaseNotes,editReleaseNotes} from './schema';
import {readReleaseNotes,generateNotes,editNotes} from './repository';

const releaseId=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
function parse<T>(schema:z.ZodType<T>,value:unknown){
 const parsed=schema.safeParse(value);
 if(!parsed.success)throw new IntegrationError(400,'invalid_release_notes_input');
 return parsed.data;
}
export function addReleaseNoteRoutes(app:Hono<AppEnvironment>){
 app.get('/releases/:id/notes',async c=>c.json(await readReleaseNotes(c.env.DB,c.get('operatorId'),parse(releaseId,c.req.param('id')))));
 app.post('/releases/:id/notes',async c=>c.json(await generateNotes(c.env.DB,c.get('operatorId'),parse(releaseId,c.req.param('id')),parse(generateReleaseNotes,await readRequestJson(c.req.raw))),201));
 app.patch('/releases/:id/notes',async c=>c.json(await editNotes(c.env.DB,c.get('operatorId'),parse(releaseId,c.req.param('id')),parse(editReleaseNotes,await readRequestJson(c.req.raw)))));
}
