import { expect } from "vitest";
export type Detail = {
  id: string;
  identifier: string;
  version: number;
  status: { id: string; category: string };
  completedAt: string | null;
  activity: { kind: string; actor: string | null }[];
};
export async function receipt<T>(response: Response, status = 200): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json() as Promise<T>;
}
