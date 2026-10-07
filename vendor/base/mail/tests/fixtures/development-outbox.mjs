function copy(message) {
  return structuredClone(message);
}

/** Test-only asynchronous outbox that keeps isolated copies of captured messages. */
export function createFixtureOutbox() {
  const captured = [];
  return Object.freeze({
    async put(message) {
      captured.push(copy(message));
    },
    messages() {
      return captured.map(copy);
    },
  });
}
