import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../app/bindings';
import { readAdministration } from '../administration/read';
import { pageQuery, paginate } from './api-pagination';
import { IntegrationError } from './errors';

const querySchema = pageQuery.extend({
 name: z.string().trim().min(1).max(120).optional(),
 projectsEnabled: z.enum(['true', 'false']).optional(),
 cursor: z.string().min(1).max(2048).optional(),
}).strict();

/** Labels keep the native workspace identity, ordering and color projection. */
export function addLabelApi(app: Hono<AppEnvironment>) {
 app.get('/labels', async c => {
  const { limit, cursor, ...filters } = querySchema.parse(c.req.query());
  const { labels } = await readAdministration(c.env.DB, c.get('operatorId'));
  const name = filters.name?.toLowerCase();
  const rows = labels.filter(label =>
   (name === undefined || label.name.toLowerCase().includes(name)) &&
   (filters.projectsEnabled === undefined || label.projectsEnabled === (filters.projectsEnabled === 'true')),
  );
  const page = await paginate(rows, c.get('operatorId'), 'labels', filters, { limit, cursor });
  return c.json({ labels: page.items, total: page.total, nextCursor: page.nextCursor });
 });
 app.get('/labels/:id', async c => {
  const { labels } = await readAdministration(c.env.DB, c.get('operatorId'));
  const label = labels.find(row => row.id === c.req.param('id'));
  if (!label) throw new IntegrationError(404, 'not_found');
  return c.json(label);
 });
}
