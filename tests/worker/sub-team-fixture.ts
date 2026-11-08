import {
  roleWorkspace,
  type Person,
} from "./role-fixture";
import type { Administration } from "../../src/core/features/administration/schema";
export type Team = Administration["teams"][number];
export type Workspace = Awaited<ReturnType<typeof roleWorkspace>>;
export async function team(
  w: Workspace,
  name: string,
  prefix: string,
  parent?: string,
) {
  const result = await w.mutate("/settings/teams", "POST", {
    name,
    identifierPrefix: prefix,
    ...(parent ? { parentTeamId: parent } : {}),
  });
  return result.teams.find((t) => t.identifierPrefix === prefix)!;
}
export const current = async (w: Workspace, id: string) =>
  (await w.state()).teams.find((t) => t.id === id)!;
export const shape = (t: Team) =>
  t.statuses.map((s) => [s.name, s.category, s.position]);
export async function change(
  w: Workspace,
  id: string,
  input: Record<string, unknown>,
  who: Person = w.people.owner,
  surface: "call" | "api" = "call",
) {
  const row = await current(w, id);
  return who[surface](
    `${surface === "call" ? "/settings" : ""}/teams/${id}/hierarchy`,
    "PUT",
    { version: row.hierarchyVersion, ...input },
  );
}
