import type {Hono} from 'hono';
import {z} from 'zod';
import type {AppEnvironment} from '../../app/bindings';
import {SettingsError} from '../settings/repository';
import {IssueAccessError} from '../issues/access';
import {readMonthCalendar} from './read';
export function addMonthCalendarRoutes(app:Hono<AppEnvironment>){app.get('/calendar/events',async c=>{try{return c.json(await readMonthCalendar(c.env.DB,c.get('operatorId'),c.env.APP_ORIGIN,c.req.query('month')));}catch(e){if(e instanceof SettingsError||e instanceof IssueAccessError)return c.json({error:e.code,message:e.message},e.status);if(e instanceof z.ZodError)return c.json({error:'invalid_request',message:'Choose a valid calendar month.'},400);throw e;}});}
