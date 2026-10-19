import { mutationDatabase } from "../auth/mutation-database";
import { activeRecipient } from "../notifications/events";
import type { ThemeChoice } from "./appearance-schema";
import { SettingsError } from "./repository";

const signInAgain = () =>
  new SettingsError("unauthenticated", "Sign in again to manage settings.", 401);

export async function readAppearance(db: D1Database, actor: string) {
  const row = await db
    .prepare(
      `SELECT COALESCE(a.theme,'system') theme FROM operators o
    LEFT JOIN operator_appearance a ON a.operator_id=o.id WHERE o.id=? AND ${activeRecipient}`,
    )
    .bind(actor)
    .first<{ theme: ThemeChoice }>();
  if (!row) throw signInAgain();
  return row;
}

/** The caller cannot name another member; native identity is fenced in the write. */
export async function updateAppearance(db: D1Database, actor: string, theme: ThemeChoice) {
  const result = await mutationDatabase(db, actor)
    .prepare(
      `INSERT INTO operator_appearance (operator_id,theme,revision,updated_at)
    SELECT o.id,?,?,? FROM operators o WHERE o.id=? AND ${activeRecipient}
    ON CONFLICT(operator_id) DO UPDATE SET theme=excluded.theme,revision=excluded.revision,updated_at=excluded.updated_at
    RETURNING operator_id`,
    )
    .bind(theme, crypto.randomUUID(), new Date().toISOString(), actor)
    .run();
  if (result.results.length !== 1) throw signInAgain();
  return { theme };
}
