/** Serializes preference writes so a slower earlier request cannot commit last. */
export function createPreferenceWriteQueue() {
  let tail: Promise<void> = Promise.resolve();

  return function enqueue<T>(write: () => Promise<T>): Promise<T> {
    const result = tail.then(write);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
