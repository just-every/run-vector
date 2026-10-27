import type { SourceBundle } from '../../../../../vendor/base/import-kit/src/d1/index';

/** Measured bounds (docs/MOVE-IN.md). One reviewed run holds up to `rows` source
 * records in a file of `bytes`; it publishes in staged batches whose native SQL
 * stays within `batchStatements` and `batchBytes`, one batch per request so each
 * request stays inside D1's `executions` per Worker invocation. */
export const importLimits = { bytes: 4194304, rows: 4000, batchStatements: 500, batchBytes: 1500000, executions: 1000 } as const;
export const importFields = ['sourceId','title','description','team','status','priority','assignee','project','cycle','labels','estimate','startDate','dueDate','expectedOutcome','customerImpact','createdAt','updatedAt','parent','dependencies','duplicateOf','archivedAt'] as const;
export type ImportField = typeof importFields[number];
export type ImportMapping = Partial<Record<ImportField,string>>;
export type ImportInput = {
  format: 'csv'|'json'|'linear-csv'|'linear-api-json'|'jira-csv'|'plane-csv'|'huly-json'|'shortcut-csv'; name: string; base64: string; source: string;
  /** With linear-api-json: the owner's Linear API file (docs/LINEAR-API-FILE.md). */
  api?: { name: string; base64: string };
  jira?: { attachmentLinks?: boolean; completedAtFallback?: 'updated'|'created'|'effective'; sourceOffset?: string; shortYearCentury?: number; originalEstimateSecondsPerUnit?: number; priorities?: Record<string,'none'|'low'|'medium'|'high'|'urgent'> };
  mapping: ImportMapping; defaults?: Partial<Record<ImportField,string>>;
  references?: Partial<Record<ImportField,Record<string,string>>>;
  /** Returned by preview; reusing it binds default timestamps to the review. */
  effectiveAt?: string;
};
export type ImportDiagnostic = { row: number; column?: number; field?: string; code: string; message: string; sourceId?: string; sourceKey?: string; value?: string };
export type JiraDateReview = { pattern: string; sample: string; shortYearCentury: number|null; sourceOffset: string; policy: string; cells: number };
export type ParsedImport = { source: SourceBundle; headers: string[]; errors: ImportDiagnostic[]; jiraDates?: JiraDateReview };
export type ImportPreview = {
  jiraDates?: JiraDateReview;
  jiraReview?: import('./jira-review').JiraReview;
  ready: boolean; fingerprint?: string; effectiveAt: string;
  headers: string[]; errors: ImportDiagnostic[]; omissions: ImportDiagnostic[];
  count: number; bounds: typeof importLimits; measured: Record<string,number>;
};
export class ImportError extends Error {
  /** `details` carries row- or record-level reasons the person must see. */
  constructor(readonly status: 400|401|403|409|413|503, readonly code: string, message = code, readonly details?: Record<string,unknown>) { super(message); }
}
