import { requireIssueProjection } from "./projection-access"
import { IssueAccessError } from "./access"
import { readRequestJson } from '../../app/input'
import type { Context } from 'hono'
import {
  acceptIssueInputSchema,
  createIssueInputSchema,
  declineIssueInputSchema,
  deferIssueInputSchema,
} from './input'
import { IssueMutationError } from './errors'
import { acceptIssue, createIssue, declineIssue, deferIssue } from './mutations'
import type { AppEnvironment } from '../../app/bindings'

const issueParamPattern = /^[A-Z]{2,10}-[1-9][0-9]*$/

export async function createIssueRoute(context: Context<AppEnvironment>) {
  const parsed = createIssueInputSchema.safeParse(await requestBody(context))
  if (!parsed.success) return invalidRequest(context, parsed.error.issues)
  return respondToMutation(
    context,
    async () => ({
      issue: await createIssue(
        context.env.DB,
        context.get('operatorId'),
        parsed.data,
      ),
      outcome: 'written' as const,
    }),
    201,
  )
}

export async function acceptIssueRoute(context: Context<AppEnvironment>) {
  return decide(context, acceptIssueInputSchema, (input) =>
    acceptIssue(
      context.env.DB,
      context.get('operatorId'),
      context.req.param('identifier') ?? '',
      input,
    ),
  )
}

export async function deferIssueRoute(context: Context<AppEnvironment>) {
  return decide(context, deferIssueInputSchema, (input) =>
    deferIssue(
      context.env.DB,
      context.get('operatorId'),
      context.req.param('identifier') ?? '',
      input,
    ),
  )
}

export async function declineIssueRoute(context: Context<AppEnvironment>) {
  return decide(context, declineIssueInputSchema, (input) =>
    declineIssue(
      context.env.DB,
      context.get('operatorId'),
      context.req.param('identifier') ?? '',
      input,
    ),
  )
}

async function decide<T>(
  context: Context<AppEnvironment>,
  schema: {
    safeParse(
      value: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: { issues: unknown } }
  },
  mutate: (
    input: T,
  ) => Promise<{ issue: { version: number; identifier: string }; outcome: 'written' | 'stale' }>,
) {
  const identifier = context.req.param('identifier') ?? ''
  if (!issueParamPattern.test(identifier))
    return invalidRequest(context, [{ message: 'Invalid issue identifier.' }])
  const parsed = schema.safeParse(await requestBody(context))
  if (!parsed.success) return invalidRequest(context, parsed.error.issues)
  return respondToMutation(context, () => mutate(parsed.data), 200)
}

async function respondToMutation(
  context: Context<AppEnvironment>,
  mutate: () => Promise<{
    issue: { version: number; identifier: string }
    outcome: 'written' | 'stale'
  }>,
  writtenStatus: 200 | 201,
) {
  try {
    const result = await mutate()
    await requireIssueProjection(context, result.issue.identifier)
    return result.outcome === 'stale'
      ? context.json(
          {
            error: 'stale_version',
            issue: result.issue,
            version: result.issue.version,
          },
          409,
        )
      : context.json(result.issue, writtenStatus)
  } catch (error) {
    if (error instanceof IssueAccessError) return context.json({error:error.code,message:error.message},error.status)
    if (!(error instanceof IssueMutationError)) throw error
    if (error.code === 'issue_not_found')
      return context.json({ error: 'not_found', message: error.message }, 404)
    return context.json(
      { error: 'invalid_request', message: error.message },
      error.code === 'invalid_transition' ? 409 : 400,
    )
  }
}

async function requestBody(context: Context<AppEnvironment>): Promise<unknown> {
  return readRequestJson(context.req.raw)
}

function invalidRequest(context: Context<AppEnvironment>, issues: unknown) {
  return context.json({ error: 'invalid_request', issues }, 400)
}
