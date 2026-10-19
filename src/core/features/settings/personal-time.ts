import { mutationDatabase } from "../auth/mutation-database";
import { activeRecipient } from "../notifications/events";
import {
  personalTimeInputSchema,
  type PersonalTime,
} from "./personal-time-schema";
import { SettingsError } from "./repository";

export async function readPersonalTime(db: D1Database, actor: string) {
  const row = await db
    .prepare(
      `SELECT p.timezone,COALESCE(p.timezone,w.timezone) effectiveTimezone,
    COALESCE(p.working_hours_start,'09:00') workingHoursStart,
    COALESCE(p.working_hours_end,'17:00') workingHoursEnd,
    COALESCE(p.working_days_json,'[1,2,3,4,5]') workingDaysJson,
    w.timezone workspaceTimezone,w.reminder_time reminderTime
    FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id
    LEFT JOIN operator_personal_time p ON p.operator_id=o.id
    WHERE o.id=? AND ${activeRecipient}`,
    )
    .bind(actor)
    .first<
      Omit<PersonalTime, "workingDays"> & {
        workingDaysJson: string;
        workspaceTimezone: string;
        reminderTime: string;
      }
    >();
  if (!row)
    throw new SettingsError(
      "unauthenticated",
      "Sign in again to manage settings.",
      401,
    );
  const { workingDaysJson, ...values } = row;
  return { ...values, workingDays: JSON.parse(workingDaysJson) as number[] };
}

/** The caller cannot name another member; native identity is fenced in the write. */
export async function updatePersonalTime(
  db: D1Database,
  actor: string,
  input: unknown,
) {
  const parsed = personalTimeInputSchema.safeParse(input);
  if (!parsed.success)
    throw new SettingsError(
      "invalid_request",
      "Choose a valid time zone and working hours.",
      400,
    );
  const values = parsed.data;
  db = mutationDatabase(db, actor);
  const result = await db
    .prepare(
      `INSERT INTO operator_personal_time
    (operator_id,timezone,working_hours_start,working_hours_end,working_days_json,revision,updated_at)
    SELECT o.id,?,?,?,?,?,? FROM operators o WHERE o.id=? AND ${activeRecipient}
    ON CONFLICT(operator_id) DO UPDATE SET timezone=excluded.timezone,
      working_hours_start=excluded.working_hours_start,working_hours_end=excluded.working_hours_end,
      working_days_json=excluded.working_days_json,revision=excluded.revision,updated_at=excluded.updated_at
    RETURNING operator_id`,
    )
    .bind(
      values.timezone,
      values.workingHoursStart,
      values.workingHoursEnd,
      JSON.stringify(values.workingDays),
      crypto.randomUUID(),
      new Date().toISOString(),
      actor,
    )
    .run();
  if (result.results.length !== 1)
    throw new SettingsError(
      "unauthenticated",
      "Sign in again to manage settings.",
      401,
    );
}
