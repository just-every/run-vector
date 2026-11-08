/** Exact convolution of empirical daily throughput, including zero days.
 * The state keeps only incomplete totals; absorbed mass is completion by day.
 * Capacity is a conservative serial-work floor in the same calendar days.
 * Nothing is extrapolated beyond the explicitly supplied capacity interval.
 */
export function forecastDays(daily: number[], remaining: number, capacityDays: number, horizon: number) {
  const frequencies = new Map<number, number>();
  for (const count of daily) frequencies.set(Math.min(remaining, count), (frequencies.get(Math.min(remaining, count)) ?? 0) + 1 / daily.length);
  let incomplete = new Float64Array(remaining);
  incomplete[0] = 1;
  let p50: number | null = null, p85: number | null = null;
  for (let day = 1; day <= horizon; day++) {
    const next = new Float64Array(remaining);
    for (let count = 0; count < remaining; count++) {
      if (!incomplete[count]) continue;
      for (const [delivered, probability] of frequencies)
        if (count + delivered < remaining) next[count + delivered] += incomplete[count] * probability;
    }
    incomplete = next;
    const finished = 1 - incomplete.reduce((sum, p) => sum + p, 0);
    if (day >= capacityDays) {
      if (p50 === null && finished + 1e-12 >= .5) p50 = day;
      if (p85 === null && finished + 1e-12 >= .85) { p85 = day; break; }
    }
  }
  return { p50, p85 };
}

export function addDays(date: string, days: number) {
  const result = new Date(date + "T12:00:00Z");
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
