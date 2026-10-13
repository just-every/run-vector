/** Resolve a local wall-clock minute without guessing through DST transitions.
 * Sampling nearby instants discovers the zone's possible offsets; round-trip
 * matching distinguishes a unique instant from a gap or repeated minute. */
export function localTimeToInstant(local: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Enter a local date and time.");
  const naive = Date.parse(local + ":00.000Z");
  if (
    !Number.isFinite(naive) ||
    new Date(naive).toISOString().slice(0, 16) !== local
  )
    throw new Error("Enter a valid calendar date and time.");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wall = (instant: number) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  };
  const offsets = new Set<number>();
  for (let h = -48; h <= 48; h += 6) {
    const probe = naive + h * 3600000;
    offsets.add(Date.parse(wall(probe) + "Z") - probe);
  }
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((instant) => wall(instant) === local + ":00");
  if (candidates.length !== 1)
    throw new Error(
      candidates.length === 0
        ? "This local time does not exist because the clocks change. Choose another time."
        : "This local time occurs twice because the clocks change. Choose an unambiguous time.",
    );
  return new Date(candidates[0]).toISOString();
}
