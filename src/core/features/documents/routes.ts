import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {readRequestJson} from '../../app/input';
import {IntegrationError} from '../integrations/errors';
import {parentKind,documentId,documentInput,documentEdit,documentComment,specificationInput} from './schema';
import {listDocuments,issueSpecification,readDocument,documentRevisions,documentComments,createDocument,editDocument,commentDocument,setSpecification} from './repository';
function parse<T>(schema:z.ZodType<T>,value:unknown){const result=schema.safeParse(value);if(!result.success)throw new IntegrationError(400,'invalid_document_input');return result.data;}
const listQuery=z.object({parentKind:parentKind.optional(),parentId:documentId.optional()}).strict().refine(v=>!!v.parentKind===!!v.parentId);
const historyQuery=z.object({beforeVersion:z.coerce.number().int().positive().optional()}).strict();
const identifier=z.string().regex(/^[A-Z]{2,10}-[1-9][0-9]*$/);
export function addDocumentRoutes(app:Hono<AppEnvironment>){
 app.get('/documents',async c=>{const q=parse(listQuery,c.req.query());return c.json(await listDocuments(c.env.DB,c.get('operatorId'),q.parentKind,q.parentId));});
 app.post('/documents',async c=>c.json(await createDocument(c.env.DB,c.get('operatorId'),parse(documentInput,await readRequestJson(c.req.raw))),201));
 app.get('/documents/:documentId',async c=>c.json(await readDocument(c.env.DB,c.get('operatorId'),parse(documentId,c.req.param('documentId')))));
 app.patch('/documents/:documentId',async c=>c.json(await editDocument(c.env.DB,c.get('operatorId'),parse(documentId,c.req.param('documentId')),parse(documentEdit,await readRequestJson(c.req.raw)))));
 app.get('/documents/:documentId/revisions',async c=>c.json(await documentRevisions(c.env.DB,c.get('operatorId'),parse(documentId,c.req.param('documentId')),parse(historyQuery,c.req.query()).beforeVersion)));
 app.get('/documents/:documentId/comments',async c=>c.json(await documentComments(c.env.DB,c.get('operatorId'),parse(documentId,c.req.param('documentId')),parse(z.object({beforeComment:documentId.optional()}).strict(),c.req.query()).beforeComment)));
 app.post('/documents/:documentId/comments',async c=>c.json(await commentDocument(c.env.DB,c.get('operatorId'),parse(documentId,c.req.param('documentId')),parse(documentComment,await readRequestJson(c.req.raw)).body),201));
 app.get('/issues/:identifier/specification',async c=>{const name=parse(identifier,c.req.param('identifier'));const issue=await c.env.DB.prepare('SELECT id FROM issues WHERE identifier=?').bind(name).first();if(!issue)throw new IntegrationError(404,'issue_not_found');return c.json({specification:await issueSpecification(c.env.DB,name)});});
 app.put('/issues/:identifier/specification',async c=>c.json(await setSpecification(c.env.DB,c.get('operatorId'),parse(identifier,c.req.param('identifier')),parse(specificationInput,await readRequestJson(c.req.raw)).documentId)));
 app.delete('/issues/:identifier/specification',async c=>c.json(await setSpecification(c.env.DB,c.get('operatorId'),parse(identifier,c.req.param('identifier')),null)));
}
