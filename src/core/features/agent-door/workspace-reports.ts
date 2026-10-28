import { z } from 'zod';
import { ToolRefusal, type ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import type { WorkerBindings } from '../../app/bindings';
import { readInsights } from '../insights/read';
import { insightQuerySchema } from '../insights/schema';
import { insightCsv } from '../insights/routes';
import { issueListQuerySchema } from '../issues/list-schema';
import { readCycle } from '../administration/read';
import { projectDetail } from '../projects/read';
import { listDashboards, readDashboard, saveDashboard, deleteDashboard } from '../dashboards/service';
import { dashboardInputSchema, dashboardFiltersSchema } from '../dashboards/schema';
import { readWorkload, setCapacity } from '../workload/service';
import { workloadQuerySchema, capacityInputSchema } from '../workload/schema';
import { nativeMutation } from './native.ts';
import { nativeId, idArgs } from './reads.ts';
import { workspaceRead, workspaceEmpty } from './workspace-shared.ts';

const insightsArgs = z.object({ filters: issueListQuerySchema.default(() => issueListQuerySchema.parse({})),
  chart: insightQuerySchema.default(() => insightQuerySchema.parse({})) }).strict();
const dashboardArgs = z.object({ id: nativeId, filters: dashboardFiltersSchema.default(() => dashboardFiltersSchema.parse({})) }).strict();
const dashboardUri = (_r: unknown, a: any) => `vector://dashboards/${a.id}`;
const privateDashboard = dashboardInputSchema.extend({ isShared: z.literal(false).default(false), teamId: z.null().default(null) });

export function workspaceReportTools(env: WorkerBindings): ToolDefinition[] {
  return [
    nativeMutation(env, { name: 'vector.report.dashboards.delete', title: 'Permanently remove an editable native dashboard',
      scope: 'reports:write', clauses: ['REPORT-003'], schema: idArgs.extend({ expectedVersion: z.number().int().positive() }),
      method: 'DELETE', path: '/dashboards/:id', params: args => ({ id: args.id }), body: args => ({ expectedVersion: args.expectedVersion }),
      classes: ['destructive'], classify: async (db, person, args) => [{ class: 'destructive', facts: { measure: 1 + (await readDashboard(db, person.id, args.id, dashboardFiltersSchema.parse({}))).dashboard.widgets.length } }],
      revision: async (db, person, args) => JSON.stringify((await readDashboard(db, person.id, args.id, dashboardFiltersSchema.parse({}))).dashboard),
      summary: async (db, person, args) => ({ target: { id: args.id, name: (await readDashboard(db, person.id, args.id, dashboardFiltersSchema.parse({}))).dashboard.name } }),
      run: (db, person, args) => deleteDashboard(db, person.id, args.id, args.expectedVersion), resource: false,
      uri: (_result, args) => `vector://dashboards/${args.id}` }),
    workspaceRead(env, { name: 'report.insights', title: 'Read native Insights and chart drill-downs', scope: 'reports:read',
      clauses: ['REPORT-001'], schema: insightsArgs, path: '/insights',
      read: (db, p, a) => readInsights(db, p.id, a.filters, a.chart) }),
    workspaceRead(env, { name: 'report.cycle_and_project_charts', title: 'Read a visible cycle or project delivery chart',
      scope: 'reports:read', clauses: ['REPORT-002'], schema: z.object({ kind: z.enum(['project', 'cycle']), id: nativeId }).strict(),
      read: async (db, p, a) => {
        if (a.kind === 'cycle') return { kind: a.kind, id: a.id, report: (await readCycle(db, p.id, a.id)).report };
        const project = await projectDetail(db, p.id, a.id);
        if (!project) throw new ToolRefusal('not_found');
        return { kind: a.kind, id: a.id, report: project.report };
      }, uri: a => `vector://${a.kind === 'cycle' ? 'cycles' : 'projects'}/${a.id}` }),
    workspaceRead(env, { name: 'report.project_completion_forecast', title: 'Read the native project completion projection and limitations',
      scope: 'reports:read', clauses: ['REPORT-002'], schema: idArgs,
      read: async (db, p, a) => { const project = await projectDetail(db, p.id, a.id);
        if (!project) throw new ToolRefusal('not_found');
        return { id: project.id, projection: project.report.projection, limitations: project.report.limitations }; },
      uri: a => `vector://projects/${a.id}` }),
    workspaceRead(env, { name: 'report.dashboards', title: 'List visible native dashboards', scope: 'reports:read',
      clauses: ['REPORT-003'], schema: workspaceEmpty, path: '/dashboards', read: (db, p) => listDashboards(db, p.id) }),
    workspaceRead(env, { name: 'report.dashboards.read', title: 'Read a visible dashboard and its current widget results',
      scope: 'reports:read', clauses: ['REPORT-003'], schema: dashboardArgs, path: '/dashboards/:id', params: a => ({ id: a.id }),
      read: (db, p, a) => readDashboard(db, p.id, a.id, a.filters), uri: a => dashboardUri(null, a) }),
    nativeMutation(env, { name: 'vector.report.dashboards.create', title: 'Create your private dashboard from native widgets',
      scope: 'reports:write', clauses: ['REPORT-003'], schema: privateDashboard,
      method: 'POST', path: '/dashboards', run: (db, p, a) => saveDashboard(db, p.id, a),
      uri: r => `vector://dashboards/${r.id}` }),
    nativeMutation(env, { name: 'vector.report.dashboards.edit', title: 'Edit your private dashboard with its native version',
      scope: 'reports:write', clauses: ['REPORT-003'], schema: z.object({ id: nativeId, input: privateDashboard,
        expectedVersion: z.number().int().positive() }).strict(), method: 'PUT', path: '/dashboards/:id',
      params: a => ({ id: a.id }), body: a => ({ ...a.input, expectedVersion: a.expectedVersion }),
      revision: async (db, p, a) => (await readDashboard(db, p.id, a.id, dashboardFiltersSchema.parse({}))).dashboard.version,
      run: async (db, p, a) => {
        const old = (await readDashboard(db, p.id, a.id, dashboardFiltersSchema.parse({}))).dashboard;
        if (old.creatorId !== p.id || old.isShared || old.teamId) throw new ToolRefusal('forbidden');
        return saveDashboard(db, p.id, a.input, a.id, a.expectedVersion);
      }, uri: dashboardUri }),
    workspaceRead(env, { name: 'report.workload', title: 'Read native workload and capacities for a cycle or due-date range',
      scope: 'reports:read', clauses: ['REPORT-004'], schema: workloadQuerySchema,
      read: (db, p, a) => readWorkload(db, p.id, a) }),
    workspaceRead(env, { name: 'report.workload.personal_capacity', title: 'Read your own capacity and native version for a workload window',
      scope: 'reports:read', clauses: ['REPORT-004'], schema: workloadQuerySchema,
      read: async (db, p, a) => { const result = await readWorkload(db, p.id, a);
        const row = result.rows.find(row => row.operatorId === p.id);
        if (!row) throw new ToolRefusal('not_found'); return { scope: result.scope, ...row }; } }),
    nativeMutation(env, { name: 'vector.report.workload.set_capacity', title: 'Set your own capacity with its native version',
      scope: 'reports:write', clauses: ['REPORT-004'], schema: z.object({ query: workloadQuerySchema, input: capacityInputSchema }).strict(),
      method: 'PUT', path: '/workload', body: a => a.input,
      revision: async (db, p, a) => (await readWorkload(db, p.id, a.query)).rows.find(row => row.operatorId === p.id)?.version ?? null,
      run: async (db, p, a) => { await setCapacity(db, p.id, a.query, a.input); return readWorkload(db, p.id, a.query); } }),
    workspaceRead(env, { name: 'report.warehouse_and_spreadsheet_export', title: 'Export the visible native Insights chart or drill-down as CSV',
      scope: 'reports:read', clauses: ['REPORT-005'], schema: insightsArgs, path: '/insights.csv',
      read: async (db, p, a) => ({ contentType: 'text/csv; charset=utf-8',
        csv: insightCsv(await readInsights(db, p.id, a.filters, a.chart)) }) }),
  ];
}
