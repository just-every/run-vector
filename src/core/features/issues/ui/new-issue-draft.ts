import { localTimeToInstant } from '../../administration/calendar';
import { isSafeHttpsUrl } from '../../links/schema.ts'

export type IntakeMeasurementDraft = {
  name: string
  value: string
  type: 'text' | 'number' | 'boolean'
}
export type IntakeCustomerReportDraft = {
  customer: string
  summary: string
  link: string
}

export const templateDraftFields = ['title','description','priority','estimate','labelIds'] as const

export type NewIssueDraft = {
  templateEditedFields?: (typeof templateDraftFields)[number][]
  mode: 'issue' | 'intake'
  intakeObservedAt: string
  intakeSummary: string
  intakeLink: string
  intakeMeasurements: IntakeMeasurementDraft[]
  intakeCustomerReports: IntakeCustomerReportDraft[]
  title: string
  teamId: string
  description: string
  statusId: string
  assigneeOperatorId: string
  projectId: string
  milestoneId: string
  cycleId: string
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none'
  labelIds: string[]
  estimate: string
  startDate: string
  dueDate: string
  expectedOutcome: string
  customerImpact: string
}

export const emptyNewIssueDraft: NewIssueDraft = {
  templateEditedFields: [],
  mode: 'issue',
  intakeObservedAt: '',
  intakeSummary: '',
  intakeLink: '',
  intakeMeasurements: [],
  intakeCustomerReports: [],
  title: '',
  teamId: '',
  description: '',
  statusId: '',
  assigneeOperatorId: '',
  projectId: '',
  milestoneId: '',
  cycleId: '',
  priority: 'none',
  labelIds: [],
  estimate: '',
  startDate: '',
  dueDate: '',
  expectedOutcome: '',
  customerImpact: '',
}

export function newIssueDraftKey(workspaceId: string, operatorId: string) {
  return `vector:new-issue-draft:${workspaceId}:${operatorId}`
}

export function parseNewIssueDraft(value: unknown): NewIssueDraft | null {
  if (!isRecord(value)) return null
  if (value.templateEditedFields !== undefined && (!Array.isArray(value.templateEditedFields) || value.templateEditedFields.some(field=>typeof field !== 'string' || !templateDraftFields.includes(field as typeof templateDraftFields[number])))) return null
  const mode = value.mode === undefined ? 'issue' : value.mode
  if (mode !== 'issue' && mode !== 'intake') return null
  const intakeFields = [
    'intakeObservedAt',
    'intakeSummary',
    'intakeLink',
  ] as const
  if (
    intakeFields.some(
      (field) => value[field] !== undefined && typeof value[field] !== 'string',
    )
  )
    return null
  const measurements =
    value.intakeMeasurements === undefined ? [] : value.intakeMeasurements
  const reports =
    value.intakeCustomerReports === undefined ? [] : value.intakeCustomerReports
  if (
    !Array.isArray(measurements) ||
    measurements.length > 50 ||
    measurements.some(
      (row) =>
        !isRecord(row) ||
        typeof row.name !== 'string' ||
        typeof row.value !== 'string' ||
        !['text', 'number', 'boolean'].includes(String(row.type)),
    )
  )
    return null
  if (
    !Array.isArray(reports) ||
    reports.length > 50 ||
    reports.some(
      (row) =>
        !isRecord(row) ||
        typeof row.customer !== 'string' ||
        typeof row.summary !== 'string' ||
        typeof row.link !== 'string',
    )
  )
    return null
  if (value.milestoneId !== undefined && typeof value.milestoneId !== 'string') return null
  if (value.startDate !== undefined && typeof value.startDate !== 'string') return null
  const priority = value.priority
  if (!['urgent', 'high', 'medium', 'low', 'none'].includes(String(priority)))
    return null
  const fields = [
    'title',
    'teamId',
    'description',
    'statusId',
    'assigneeOperatorId',
    'projectId',
    'cycleId',
    'estimate',
    'dueDate',
    'expectedOutcome',
    'customerImpact',
  ] as const
  if (fields.some((field) => typeof value[field] !== 'string')) return null
  if (
    !Array.isArray(value.labelIds) ||
    value.labelIds.some((label) => typeof label !== 'string')
  )
    return null
  const parsed: NewIssueDraft = {
    mode,
    intakeObservedAt: (value.intakeObservedAt as string | undefined) ?? '',
    intakeSummary: (value.intakeSummary as string | undefined) ?? '',
    intakeLink: (value.intakeLink as string | undefined) ?? '',
    intakeMeasurements: measurements.map((row) => ({
      name: row.name,
      value: row.value,
      type: row.type,
    })) as IntakeMeasurementDraft[],
    intakeCustomerReports: reports.map((row) => ({
      customer: row.customer,
      summary: row.summary,
      link: row.link,
    })) as IntakeCustomerReportDraft[],
    title: value.title as string,
    teamId: value.teamId as string,
    description: value.description as string,
    statusId: value.statusId as string,
    assigneeOperatorId: value.assigneeOperatorId as string,
    projectId: value.projectId as string,
    milestoneId: (value.milestoneId as string | undefined) ?? '',
    cycleId: value.cycleId as string,
    priority: priority as NewIssueDraft['priority'],
    labelIds: value.labelIds as string[],
    estimate: value.estimate as string,
    startDate: (value.startDate as string | undefined) ?? '',
    dueDate: value.dueDate as string,
    expectedOutcome: value.expectedOutcome as string,
    customerImpact: value.customerImpact as string,
  }
  // Older drafts did not distinguish untouched blanks from deliberate edits.
  // Preserve every field in a content-bearing legacy draft; a team choice alone
  // can still receive its team's newly configured default.
  const legacyContent=Object.keys(emptyNewIssueDraft).filter(key=>!['teamId','mode','templateEditedFields'].includes(key)).some(key=>JSON.stringify(parsed[key as keyof NewIssueDraft])!==JSON.stringify(emptyNewIssueDraft[key as keyof NewIssueDraft]));
  parsed.templateEditedFields=value.templateEditedFields === undefined ? (legacyContent ? [...templateDraftFields] : []) : [...new Set(value.templateEditedFields as typeof templateDraftFields[number][])];
  return parsed
}

export function hasUnsavedDraft(values: NewIssueDraft, defaults: NewIssueDraft = emptyNewIssueDraft) {
  return (Object.keys(defaults) as (keyof NewIssueDraft)[]).some(
    key => JSON.stringify(values[key]) !== JSON.stringify(defaults[key]),
  )
}

export function createIssuePayload(values: NewIssueDraft) {
  return {
    title: values.title,
    teamId: values.teamId,
    description: values.description,
    ...(values.statusId ? { statusId: values.statusId } : {}),
    assigneeOperatorId: values.assigneeOperatorId || null,
    projectId: values.projectId || null,
    milestoneId: values.milestoneId || null,
    cycleId: values.cycleId || null,
    priority: values.priority,
    labelIds: values.labelIds,
    estimate: values.estimate === '' ? null : Number(values.estimate),
    startDate: values.startDate || null,
    dueDate: values.dueDate || null,
    expectedOutcome: values.expectedOutcome || null,
    customerImpact: values.customerImpact || null,
  }
}

export function createIntakePayload(values: NewIssueDraft, timezone: string) {
  const measurements: Record<string, string | number | boolean> =
    Object.create(null)
  if (
    values.intakeMeasurements.length > 50 ||
    values.intakeCustomerReports.length > 50
  )
    throw new Error('Use at most 50 measurements and 50 customer reports.')
  for (const row of values.intakeMeasurements) {
    const name = row.name.trim()
    if (!name || name.length > 100)
      throw new Error('Each measurement needs a name of up to 100 characters.')
    if (Object.hasOwn(measurements, name))
      throw new Error(`Measurement names must be unique: ${name}.`)
    if (row.type === 'number') {
      const number = Number(row.value)
      if (!row.value.trim() || !Number.isFinite(number))
        throw new Error(`Enter a valid number for ${name}.`)
      measurements[name] = number
    } else if (row.type === 'boolean') {
      if (row.value !== 'true' && row.value !== 'false')
        throw new Error(`Choose yes or no for ${name}.`)
      measurements[name] = row.value === 'true'
    } else {
      if (row.value.length > 20_000)
        throw new Error(`Use at most 20,000 characters for ${name}.`)
      measurements[name] = row.value
    }
  }
  const customerReports = values.intakeCustomerReports.map((row, index) => {
    const summary = row.summary.trim()
    if (!summary || summary.length > 100_000)
      throw new Error(
        `Customer report ${index + 1} needs a summary of up to 100,000 characters.`,
      )
    const customer = row.customer.trim()
    if (customer.length > 500)
      throw new Error(`Use at most 500 characters for customer ${index + 1}.`)
    return {
      ...(customer ? { customer } : {}),
      summary,
      link: intakeLink(row.link, `Customer report ${index + 1} link`),
    }
  })
  let observedAt: string | undefined
  if (values.intakeObservedAt) {
    observedAt = localTimeToInstant(values.intakeObservedAt, timezone)
  }
  const summary = values.intakeSummary.trim()
  return {
    title: values.title,
    teamId: values.teamId,
    description: values.description,
    ...(observedAt ? { observedAt } : {}),
    ...(summary ? { summary } : {}),
    link: intakeLink(values.intakeLink, 'Evidence link'),
    measurements,
    customerReports,
    expectedOutcome: values.expectedOutcome || null,
    customerImpact: values.customerImpact || null,
  }
}

function intakeLink(value: string, label: string) {
  if (value === '') return null
  if (value.length > 2000 || !isSafeHttpsUrl(value))
    throw new Error(
      `${label} must use HTTPS without credentials or control characters.`,
    )
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
