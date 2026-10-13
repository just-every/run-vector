import { Buffer } from 'node:buffer';
import type { Json } from '../../../../../vendor/base/import-kit/src/d1/index';
import { ImportError,importLimits,type ImportDiagnostic } from './types';

/** One Linear issue from the owner's API file (docs/LINEAR-API-FILE.md), reduced
 * to what Vector imports. It travels in its CSV row's payload under this key, so
 * the reviewed fingerprint and source conflicts cover it like any column. */
export const apiPayloadKey = '@linearApi';
export type ApiComment = { author: string; body: string; createdAt: string };
export type ApiIssue = { parent: string|null; comments: ApiComment[]; links: { title: string; url: string }[]; relations: { type: string; identifier: string }[] };
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const nodes = (value: unknown) => object(value) && Array.isArray(value.nodes) ? value.nodes as unknown[] : value === undefined || value === null ? [] : null;
const text = (value: unknown) => typeof value === 'string' ? value : null;

/** Reads the file; every malformed issue is reported by its position and Linear ID. */
export function readApiFile(base64: string): { issues: Map<string, ApiIssue>; errors: ImportDiagnostic[] } {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64') !== base64) throw new ImportError(400, 'invalid_base64');
  if (bytes.byteLength > importLimits.bytes) throw new ImportError(413, 'import_byte_limit');
  let root: unknown;
  try { root = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')); }
  catch { throw new ImportError(400, 'invalid_api_file', 'The Linear API file is not valid UTF-8 JSON.'); }
  if (!object(root) || !Array.isArray(root.issues)) throw new ImportError(400, 'invalid_api_file', 'The Linear API file needs an "issues" array (docs/LINEAR-API-FILE.md).');
  const issues = new Map<string, ApiIssue>(), errors: ImportDiagnostic[] = [];
  root.issues.forEach((node, index) => {
    const row = index + 1, identifier = object(node) ? text(node.identifier) : null;
    const refuse = (field: string, message: string) => errors.push({ row, field: 'api ' + field, code: 'invalid_api_issue', message: `API issue ${row}${identifier ? ' (' + identifier + ')' : ''}: ${message}` });
    if (!object(node) || !identifier) return refuse('identifier', 'needs an identifier such as ENG-123.');
    if (issues.has(identifier)) return refuse('identifier', 'appears more than once.');
    const comments = nodes(node.comments), attachments = nodes(node.attachments), relations = nodes(node.relations);
    if (!comments || !attachments || !relations) return refuse('connections', 'comments, attachments and relations must each be { "nodes": [...] }.');
    const parent = node.parent === undefined || node.parent === null ? null : object(node.parent) ? text(node.parent.identifier) : null;
    if (node.parent && !parent) return refuse('parent', 'parent must be { "identifier": "ENG-1" } or null.');
    const issue: ApiIssue = { parent, comments: [], links: [], relations: [] };
    for (const comment of comments) {
      if (!object(comment) || !text(comment.body) || !text(comment.createdAt)) return refuse('comments', 'each comment needs body and createdAt.');
      const user = object(comment.user) ? comment.user : null, external = object(comment.externalUser) ? comment.externalUser : null, bot = object(comment.botActor) ? comment.botActor : null;
      const author = text(user?.displayName) || text(user?.name) || text(external?.name) || text(bot?.name) || 'Unknown Linear author';
      issue.comments.push({ author: author.slice(0, 200), body: comment.body as string, createdAt: comment.createdAt as string });
    }
    for (const attachment of attachments) {
      if (!object(attachment) || !text(attachment.url)) return refuse('attachments', 'each attachment needs a url.');
      issue.links.push({ title: text(attachment.title) ?? '', url: attachment.url as string });
    }
    for (const relation of relations) {
      if (!object(relation) || !text(relation.type) || !object(relation.relatedIssue) || !text(relation.relatedIssue.identifier)) return refuse('relations', 'each relation needs type and relatedIssue.identifier.');
      issue.relations.push({ type: relation.type as string, identifier: relation.relatedIssue.identifier as string });
    }
    issues.set(identifier, issue);
  });
  return { issues, errors };
}
export function apiIssue(payload: Record<string, Json>): ApiIssue | null {
  const value = payload[apiPayloadKey];
  return value === undefined ? null : value as unknown as ApiIssue;
}
