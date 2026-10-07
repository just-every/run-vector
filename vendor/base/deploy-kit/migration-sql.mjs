import { assert } from './validation.mjs';

const safe = condition => assert(condition, 'unsafe-migration-control');

// Only unquoted SQL tokens affect control flow. Unterminated quoted/comment
// input could swallow the controller's appended ledger update, so reject it.
function* tokens(sql) {
  for (let i = 0; i < sql.length;) {
    const ch = sql[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i + 2);
      i = end < 0 ? sql.length : end + 1; continue;
    }
    if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2);
      safe(end >= 0); i = end + 2; continue;
    }
    if ("'\"`[".includes(ch)) {
      const close = ch === '[' ? ']' : ch;
      let closed = false;
      for (i++; i < sql.length; i++) {
        if (sql[i] !== close) continue;
        if (close !== ']' && sql[i + 1] === close) { i++; continue; }
        i++; closed = true; break;
      }
      safe(closed); yield null; continue;
    }
    if (/[a-zA-Z_\u0080-\uffff]/.test(ch)) {
      const start = i++;
      while (i < sql.length && /[a-zA-Z0-9_$\u0080-\uffff]/.test(sql[i])) i++;
      yield sql.slice(start, i).toUpperCase(); continue;
    }
    yield ch; i++;
  }
}

export function assertMigrationSql(sql) {
  // Preserve the controller-owned ledger restriction even in quoted names and
  // SQLite's legacy single-quoted identifier syntax. NUL can truncate SQL.
  safe(!/\b(?:_rer_deploy_migrations|d1_migrations)\b/i.test(sql) && !sql.includes('\0'));
  let prefix = [], trigger = null, cases = 0, parens = 0, statementStart = true;
  for (const token of tokens(sql)) {
    safe(!['COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'ATTACH', 'DETACH', 'VACUUM'].includes(token));
    if (token === ';') {
      safe(cases === 0 && parens === 0 && trigger !== 'header');
      if (trigger !== 'body') { prefix = []; trigger = null; }
      statementStart = true; continue;
    }
    safe(trigger !== 'ended');
    if (prefix.length < 3 && trigger === null) {
      prefix.push(token);
      if (prefix[0] === 'CREATE' && (prefix[1] === 'TRIGGER' ||
          (['TEMP', 'TEMPORARY'].includes(prefix[1]) && prefix[2] === 'TRIGGER'))) trigger = 'header';
    }
    if (token === 'BEGIN') {
      // A trigger header's BEGIN opens its body; every other BEGIN is refused.
      safe(trigger === 'header' && cases === 0 && parens === 0);
      trigger = 'body'; statementStart = true; continue;
    }
    if (token === 'CASE') cases++;
    if (token === 'END') {
      if (cases > 0) cases--;
      else {
        safe(trigger === 'body' && statementStart && parens === 0);
        trigger = 'ended';
      }
    }
    if (token === '(') parens++;
    if (token === ')') { parens--; safe(parens >= 0); }
    statementStart = false;
  }
  safe(cases === 0 && parens === 0 && trigger !== 'header' && trigger !== 'body');
}
