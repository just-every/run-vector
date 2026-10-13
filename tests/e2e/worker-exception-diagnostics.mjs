// Failure artifacts retain classifications and known source frames, never the
// exception message, SQL, request values, or unrecognized filesystem paths.
const classes = new Set([
  "Error",
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "RangeError",
  "AbortError",
  "DOMException",
  "AssertionError",
  "AuthError",
]);
const codes =
  /\b(?:D1_ERROR|SQLITE_(?:BUSY|LOCKED|CONSTRAINT|CONSTRAINT_TRIGGER|CONSTRAINT_FOREIGNKEY|CONSTRAINT_UNIQUE|CONSTRAINT_NOTNULL|ERROR|IOERR|FULL|CORRUPT|NOTADB|READONLY|ABORT|INTERRUPT))\b/g;
const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");

function sourceFrame(line, sourceFiles) {
  const match = line.match(/^\s*at\s+.*?([^\s()]+):(\d+):(\d+)\)?\s*$/);
  if (!match) return null;
  const location = match[1].replaceAll("\\", "/");
  const file = [...sourceFiles, "cloudflare-internal:d1-api"].find(
    (name) => location === name || location.endsWith("/" + name),
  );
  return {
    file: file ?? "<runtime>",
    line: Number(match[2]),
    column: Number(match[3]),
  };
}

export function exceptionClassification(error, sourceFiles) {
  return {
    class: classes.has(error?.name) ? error.name : "Error",
    frames: String(error?.stack ?? "")
      .split("\n")
      .map((line) => sourceFrame(stripAnsi(line), sourceFiles))
      .filter(Boolean),
  };
}

export function createWorkerExceptionDiagnostics(sourceFiles = []) {
  const exceptions = [];
  let pending = "",
    lineNumber = 0,
    current = null;
  function line(text, observedAt) {
    lineNumber++;
    const clean = stripAnsi(text);
    const exception = clean.match(
      /(?:^|\s)([A-Za-z]*Error|DOMException)(?::|\s*\[)/,
    );
    if (exception) {
      current = {
        observedAt,
        line: lineNumber,
        class: classes.has(exception[1]) ? exception[1] : "Error",
        cause: /\[cause\]/.test(clean),
        codes: [...new Set(clean.match(codes) ?? [])],
        frames: [],
      };
      exceptions.push(current);
    } else if (current) {
      const frame = sourceFrame(clean, sourceFiles);
      if (frame) current.frames.push(frame);
    }
  }
  return {
    append(chunk) {
      pending += String(chunk);
      const lines = pending.split("\n");
      pending = lines.pop();
      const at = performance.now();
      for (const value of lines) line(value, at);
    },
    snapshot() {
      if (pending) {
        line(pending, performance.now());
        pending = "";
      }
      return structuredClone(exceptions);
    },
  };
}
