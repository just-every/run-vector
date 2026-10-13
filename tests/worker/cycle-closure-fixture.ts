import { expect } from "vitest";
import { setupAdministration } from "./administration-fixture";
import { cycleDetailSchema } from "../../src/core/features/administration/schema";
let serial = 0;
export async function closureFixture(next = true) {
  const f = await setupAdministration(),
    suffix = String.fromCharCode(65 + serial++);
  await f.mutate("/settings", "PATCH", { timezone: "UTC" });
  const team = (
    await f.mutate("/settings/teams", "POST", {
      name: "Closure " + suffix,
      identifierPrefix: "CC" + suffix,
    })
  ).teams.find((t) => t.identifierPrefix === "CC" + suffix)!;
  const first = {
    teamId: team.id,
    name: "Closing cycle",
    startsLocal: "2026-09-01T00:00",
    endsLocal: "2026-09-08T00:00",
    capacity: 15,
  };
  await f.mutate("/settings/cycles", "POST", first);
  if (next)
    await f.mutate("/settings/cycles", "POST", {
      ...first,
      name: "Next cycle",
      startsLocal: "2026-09-08T00:00",
      endsLocal: "2026-09-15T00:00",
    });
  const cycles = (await f.state()).cycles.filter((c) => c.teamId === team.id),
    closing = cycles.find((c) => c.name === "Closing cycle")!,
    destination = cycles.find((c) => c.name === "Next cycle");
  const detail = async () => {
    const r = await f.call("/cycles/" + closing.id);
    expect(r.status).toBe(200);
    return cycleDetailSchema.parse(await r.json());
  };
  return {
    ...f,
    create: (extra: Record<string, unknown> = {}) =>
      f.create({ teamId: team.id, ...extra }),
    team,
    closing,
    destination,
    detail,
  };
}
