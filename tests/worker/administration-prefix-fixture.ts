import { env } from "cloudflare:workers";
import { expect } from "vitest";
import { createIssueInputSchema } from "../../src/core/features/issues/input";
import { createIssueRecord } from "../../src/core/features/issues/repository";
import { operatorIntakeInputSchema } from "../../src/core/features/operator-intake/input";
import { createOperatorIntake } from "../../src/core/features/operator-intake/repository";

export type CreationPath = "issues" | "intake";

export function createThroughRepository(
  path: CreationPath,
  db: D1Database,
  actor: string,
  teamId: string,
  title: string,
) {
  return path === "issues"
    ? createIssueRecord(db, {
        actorOperatorId: actor,
        input: createIssueInputSchema.parse({ teamId, title }),
        now: new Date(),
      })
    : createOperatorIntake(
        db,
        actor,
        operatorIntakeInputSchema.parse({ teamId, title }),
      );
}

export async function sequence(teamId: string) {
  return env.DB.prepare(
    "SELECT last_sequence FROM team_issue_sequences WHERE team_id=?",
  ).bind(teamId).first<number>("last_sequence");
}

export async function prefixSequence(prefix: string) {
  return env.DB.prepare(
    "SELECT last_sequence FROM issue_prefix_sequences WHERE identifier_prefix=?",
  ).bind(prefix).first<number>("last_sequence");
}

export async function creationCounts(teamId: string) {
  return env.DB.prepare(`SELECT
    (SELECT count(*) FROM issues WHERE team_id=?) AS issues,
    (SELECT count(*) FROM evidence_revisions e JOIN issues i ON i.id=e.issue_id WHERE i.team_id=?) AS evidence,
    (SELECT count(*) FROM issue_activity a JOIN issues i ON i.id=a.issue_id WHERE i.team_id=?) AS activity,
    (SELECT count(*) FROM team_issue_history WHERE team_id=?) AS history`)
    .bind(teamId, teamId, teamId, teamId).first();
}

/** Interrupt the actual persistence batch only after the reservation is durable. */
export function afterReservation(teamId: string, run: () => Promise<unknown>) {
  let fired = false;
  const db = new Proxy(env.DB, {
    get(target, key) {
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          if (!fired && (await sequence(teamId)) !== null) {
            fired = true;
            expect(await sequence(teamId)).toBe(1);
            expect(await creationCounts(teamId)).toEqual({
              issues: 0, evidence: 0, activity: 0, history: 0,
            });
            await run();
          }
          return target.batch(statements);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db, fired: () => fired };
}
