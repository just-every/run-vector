export function localDateTimeValue(date: Date) {
  const part = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function futureLocalInstant(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    throw new Error("Choose a future date and time.");
  if (localDateTimeValue(date) !== value)
    throw new Error("That local time does not exist. Choose another time.");
  return date.toISOString();
}

export function followUpTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
