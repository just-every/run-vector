import { z } from 'zod';
import type { WorkerBindings } from '../../app/bindings';
import type { ToolDefinition } from '../../../../vendor/base/agent-door/index.ts';
import { cycleCreateSchema, cycleScheduleSchema } from '../administration/schema';
import { createCycle } from '../administration/cycles';
import { readAdministration, readCycle } from '../administration/read';
import { updateTeam } from '../administration/teams';
import { saveCycleSchedule } from '../cycle-schedule/settings';
import { calendarDay, nextInterval } from '../cycle-schedule/calendar';
import { nativeMutation } from './native.ts';
import { idArgs, nativeId } from './reads.ts';
import { planningRead, planningRevision, planningRow, requiredPlanning, standard } from './planning-shared.ts';

export function planningCycleTools(env: WorkerBindings): ToolDefinition[] {
  return [
    planningRead(env, {
      name: 'vector.cycles.next_window', title: 'Find the next available two-week cycle window in workspace local time',
      scope: 'cycles:read', clauses: ['CYCLE-001'], schema: z.object({ teamId: nativeId }).strict(),
      read: async (db, p, a) => {
        await planningRow(db, 'teams', a.teamId);
        const data = await readAdministration(db, p.id), timezone = data.workspace.timezone;
        let after = new Date().toISOString();
        for (const cycle of data.cycles) if (cycle.teamId === a.teamId && cycle.endsAt > after) after = cycle.endsAt;
        const interval = nextInterval(after, timezone, 1, 2);
        return { teamId: a.teamId, timezone, startsLocal: calendarDay(interval.startsAt, timezone) + 'T00:00',
          endsLocal: calendarDay(interval.endsAt, timezone) + 'T00:00' };
      },
    }),
    nativeMutation(env, {
      name: 'vector.cycle.time_box', title: 'Create a non-overlapping team cycle in workspace local time', scope: 'cycles:write',
      clauses: ['CYCLE-001'], schema: cycleCreateSchema, method: 'POST', path: '/settings/cycles',
      run: async (db, p, a) => readCycle(db, p.id, await createCycle(db, p.id, a)),
      uri: r => `vector://cycles/${r.cycle.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.cycle.automatic_cycle_schedule', title: 'Save a team cycle schedule and generate its upcoming cycles',
      scope: 'cycles:write', clauses: ['CYCLE-007'], schema: z.object({ id: nativeId, input: cycleScheduleSchema }).strict(),
      method: 'PUT', path: '/settings/teams/:id/cycle-schedule', params: a => ({ id: a.id }), body: a => a.input,
      classify: async (db, _p, a) => {
        await planningRow(db, 'teams', a.id);
        const future = (await db.prepare('SELECT schedule_revision FROM cycles WHERE team_id=? AND starts_at>? AND closed_at IS NULL')
          .bind(a.id, new Date().toISOString()).all<{ schedule_revision: string | null }>()).results;
        // Saving a new native schedule revision reschedules its future generated
        // cycles and fills only the remaining horizon, preserving manual cycles.
        return standard(1 + future.filter(c => c.schedule_revision !== null).length + Math.max(0, a.input.upcomingCount - future.length));
      },
      run: async (db, p, a) => { await saveCycleSchedule(db, p.id, a.id, a.input);
        const value = await readAdministration(db, p.id);
        return { schedule: requiredPlanning(value.cycleSchedules.find(s => s.teamId === a.id)), cycles: value.cycles.filter(c => c.teamId === a.id) }; },
      uri: (_r, a) => `vector://teams/${a.id}`,
    }),
    nativeMutation(env, {
      name: 'vector.cycle.automatic_cycle_membership', title: 'Set automatic cycle membership on started and completed issues',
      scope: 'teams:write', clauses: ['CYCLE-008'],
      schema: z.object({ id: nativeId, input: z.object({ autoCycleStarted: z.boolean(), autoCycleCompleted: z.boolean() }).strict() }).strict(),
      method: 'PATCH', path: '/settings/teams/:id', params: a => ({ id: a.id }), body: a => a.input,
      revision: (db, _p, a) => planningRevision(db, 'teams', a.id),
      run: async (db, p, a) => { await updateTeam(db, p.id, a.id, a.input);
        return requiredPlanning((await readAdministration(db, p.id)).teams.find(t => t.id === a.id)); },
      uri: (_r, a) => `vector://teams/${a.id}`,
    }),
    ...([
      ['vector.cycle.progress_and_capacity', 'Read cycle progress and capacity', ['CYCLE-003']],
      ['vector.cycle.closure_snapshot', 'Read the retained cycle closure snapshot', ['CYCLE-005']],
      ['vector.cycle.missing_next_cycle', 'Read the retained rollover failure and affected issue identifiers', ['CYCLE-006']],
    ] as const).map(([name, title, clauses]) => planningRead(env, { name, title, scope: 'cycles:read', clauses: [...clauses],
      schema: idArgs, read: (db, p, a) => readCycle(db, p.id, a.id), uri: a => `vector://cycles/${a.id}` })),
  ];
}
