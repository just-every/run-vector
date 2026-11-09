import type { Hono, Context } from 'hono';
import type { AppEnvironment } from '../../app/bindings';
import { readRequestJson } from '../../app/input';
import { SettingsError } from '../settings/repository';
import { ruleInput, ruleSave } from './schema';
import { dryRun, readRules, readRunLog, saveRule } from './settings';
async function respond(c: Context<AppEnvironment>, action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof SettingsError) return c.json({error:error.code,message:error.message},error.status);
    throw error;
  }
}
export function addAutomationRuleRoutes(app: Hono<AppEnvironment>) {
  for (const base of ['/settings/automation-rules','/settings/teams/:id/automation-rules']) {
    const team = (params: Record<string,string>) => params.id ?? null;
    app.get(base, async c => respond(c,async () => c.json(await readRules(c.env.DB,c.get('operatorId'),team(c.req.param())))));
    app.get(base+'/:ruleId/runs', async c => respond(c,async () => c.json(await readRunLog(c.env.DB,c.get('operatorId'),team(c.req.param()),c.req.param('ruleId')!))));
    app.post(base+'/dry-run', async c => respond(c,async () => {
      const input = ruleInput.safeParse(await readRequestJson(c.req.raw));
      if (!input.success) throw new SettingsError('invalid_rule','Choose a label, priority, Slack destination and monthly budget.',400);
      return c.json(await dryRun(c.env.DB,c.get('operatorId'),team(c.req.param()),input.data));
    }));
    app.post(base, async c => respond(c,async () => {
      const input = ruleSave.safeParse(await readRequestJson(c.req.raw));
      if (!input.success) throw new SettingsError('invalid_rule','Choose a label, priority, Slack destination and monthly budget.',400);
      const {expectedVersion,...rule} = input.data;
      return c.json(await saveRule(c.env.DB,c.get('operatorId'),team(c.req.param()),null,rule,expectedVersion),201);
    }));
    app.patch(base+'/:ruleId', async c => respond(c,async () => {
      const input = ruleSave.safeParse(await readRequestJson(c.req.raw));
      if (!input.success) throw new SettingsError('invalid_rule','Choose a label, priority, Slack destination and monthly budget.',400);
      const {expectedVersion,...rule} = input.data;
      return c.json(await saveRule(c.env.DB,c.get('operatorId'),team(c.req.param()),c.req.param('ruleId')!,rule,expectedVersion));
    }));
  }
}
