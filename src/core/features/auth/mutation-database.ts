/** An API request is admitted before its body is read. Bind its repositories to
 * the same native identity and assert it inside each D1 transaction, including
 * single statements and ORM RETURNING queries. A failed guard aborts the batch,
 * so removal/sign-out cannot leave an activity without its requested mutation.
 */
export class MutationAccessError extends Error {
  constructor() {
    super("The operator session is no longer active. Sign in again.");
  }
}
/** A role or team setting the request was admitted under changed before its
 * write committed (ROLE-001); nothing was written. */
export class AuthorityChangedError extends Error {
  constructor() { super('Your workspace role or team permissions changed. Reload and try again.'); }
}
export class RestoreReservationError extends Error {
  constructor() { super('The workspace is reserved for an archive restore. Finish or abort that restore first.'); }
}
export function isMutationAccessError(error: unknown): boolean {
  return (
    error instanceof MutationAccessError ||
    (error instanceof Error &&
      error.cause !== undefined &&
      isMutationAccessError(error.cause))
  );
}

type BaseFence = { sessionId: string; operatorVersion: number };
export type NativeAccessFence = { sql: string; values: (string|number|null)[] };
type Identity = { actor: string; sessionHash?: BaseFence; accessFence?: NativeAccessFence; authorityFence?: NativeAccessFence };
const scopes = new WeakMap<
  D1Database,
  { source: D1Database; identity: Identity }
>();

/** The persisted file reservation/removal intent authorizes ONLY its settlement.
 * It must not authorize another operator command. */
export function fileSettlementDatabase(db: D1Database): D1Database {
  return scopes.get(db)?.source ?? db;
}

export function mutationDatabase(
  source: D1Database,
  actor: string,
  sessionHash?: BaseFence,
  accessFence?: NativeAccessFence,
  authorityFence?: NativeAccessFence,
): D1Database {
  const existing = scopes.get(source);
  if (existing) {
    if (existing.identity.actor !== actor) throw new MutationAccessError();
    return source; // Keep the stronger native-session fence on repository calls.
  }
  const identity = { actor, sessionHash, accessFence, authorityFence };
  const base = sessionHash;
  const sessionClause = base
    ? ` AND EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_sessions s ON s.operator_id=m.auth_id JOIN oa_operators a ON a.id=m.auth_id
      WHERE m.operator_id=o.id AND s.id=? AND s.operator_version=? AND a.version=s.operator_version
      AND a.status='active' AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))`
    : '';
  const identityEligible = `EXISTS(SELECT 1 FROM operators o WHERE o.id=? AND o.removed_at IS NULL${sessionClause})${accessFence ? " AND ("+accessFence.sql+")" : ""}`;
  const authorized = authorityFence ? ` AND (${authorityFence.sql})` : '';
  const eligible = `${identityEligible}${authorized} AND NOT EXISTS(SELECT 1 FROM vector_http_restore)`;
  const identityValues = [...(base ? [actor, base.sessionId, base.operatorVersion] : [actor]),...(accessFence?.values??[])];
  const values = [...identityValues, ...(authorityFence?.values ?? [])];
  const statements = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const active = () =>
    source
      .prepare(`SELECT ${identityEligible} AS active`)
      .bind(...identityValues)
      .first<number>("active");
  const admitted = () =>
    source
      .prepare(`SELECT ${authorityFence?.sql ?? '1'} AS admitted`)
      .bind(...(authorityFence?.values ?? []))
      .first<number>("admitted");
  async function batch<T>(
    items: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    // SQLite evaluates CASE lazily. Invalid JSON deliberately aborts the entire
    // D1 batch on denial; no schema change or persistent guard row is needed.
    const guard = source
      .prepare(
        accessFence ? `UPDATE vector_integration_authority_guard SET admitted=CASE WHEN ${eligible} THEN 1 ELSE 0 END WHERE id=1` : `SELECT CASE WHEN ${eligible} THEN 1 ELSE json('native mutation denied') END`,
      )
      .bind(...values);
    try {
      return (
        await source.batch<T>([
          guard,
          ...items.map((item) => statements.get(item) ?? item),
          ...(accessFence ? [guard] : []),
        ])
      ).slice(1,accessFence ? -1 : undefined);
    } catch (error) {
      if (authorityFence && (await active()) && !(await admitted())) throw new AuthorityChangedError();
      if ((accessFence && String(error).includes('vector_integration_authority')) || !(await active())) throw new MutationAccessError();
      if (await source.prepare('SELECT 1 FROM vector_http_restore').first()) throw new RestoreReservationError();
      throw error;
    }
  }
  function wrap(statement: D1PreparedStatement): D1PreparedStatement {
    const wrapped = new Proxy(statement, {
      get(target, key) {
        if (key === "bind")
          return (...args: unknown[]) => wrap(target.bind(...args));
        if (key === "run" || key === "all")
          return async () => (await batch([target]))[0];
        if (key === "first")
          return async (column?: string) => {
            const row = (await batch<Record<string, unknown>>([target]))[0]
              .results[0];
            if (!row) return null;
            if (column === undefined) return row;
            if (!(column in row))
              throw new Error(`D1 column does not exist: ${column}`);
            return row[column];
          };
        if (key === "raw")
          return async (options?: { columnNames?: boolean }) => {
            // All current ORM queries use positional rows without columnNames.
            // Refuse unsupported empty-result column metadata instead of guessing.
            if (options?.columnNames)
              throw new Error(
                "Native mutation queries must use named results for column metadata.",
              );
            return (
              await batch<Record<string, unknown>>([target])
            )[0].results.map(Object.values);
          };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    statements.set(wrapped, statement);
    return wrapped;
  }
  const scoped = new Proxy(source, {
    get(target, key) {
      if (key === "prepare")
        return (query: string) =>
          /^\s*SELECT\b/i.test(query)
            ? target.prepare(query)
            : wrap(target.prepare(query));
      if (key === "batch") return batch;
      if (key === "exec" || key === "withSession" || key === "dump")
        return () => {
          throw new Error("Native mutations require prepared D1 statements.");
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  scopes.set(scoped, { source, identity });
  return scoped;
}
