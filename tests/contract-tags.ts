/** Pure registration adapter for Node, Worker and browser acceptance runners. */
export function contractTitle(ids: string, name: string) {
  return `[${ids}] ${name}`;
}
export function contractWith<T>(
  runner: (name: string, run: () => void | Promise<void>) => T,
  ids: string,
  name: string,
  run: () => void | Promise<void>,
): T {
  return runner(contractTitle(ids, name), run);
}
