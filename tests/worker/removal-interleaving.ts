import { env } from "cloudflare:workers";
/** Only the scheduling interleaving is injected. Statements, transactions and
 * revocation all execute on the real Worker D1 binding. */
export function beforeCommit(
  predicate: (sql: string) => boolean,
  action: () => Promise<void>,
) {
  const queries = new WeakMap<object, string>();
  let used = false;
  function statement(
    raw: D1PreparedStatement,
    sql: string,
  ): D1PreparedStatement {
    const wrapped = new Proxy(raw, {
      get(target, key) {
        if (key === "bind")
          return (...args: unknown[]) => statement(target.bind(...args), sql);
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    queries.set(wrapped, sql);
    return wrapped;
  }
  return new Proxy(env.DB, {
    get(target, key) {
      if (key === "prepare")
        return (sql: string) => statement(target.prepare(sql), sql);
      if (key === "batch")
        return async (items: D1PreparedStatement[]) => {
          if (
            !used &&
            items.some((item) => predicate(queries.get(item) ?? ""))
          ) {
            used = true;
            await action();
          }
          return target.batch(items);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
