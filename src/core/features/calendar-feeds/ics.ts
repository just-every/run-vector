import type { CalendarEvent } from "./schema";
const escapeText = (text: string) => text.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
const instant = (at: string) => new Date(at).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
/** RFC 5545 content lines: at most 75 octets, never split a UTF-8 code point. */
export function foldLine(line: string) {
  const encoder = new TextEncoder();
  let result = "", bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { result += "\r\n "; bytes = 1; }
    result += character; bytes += length;
  }
  return result;
}
export function calendarIcs(events: CalendarEvent[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vector//Private calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const event of events) lines.push("BEGIN:VEVENT", "UID:" + event.id + "@vector",
    "DTSTAMP:" + instant(event.updatedAt), "LAST-MODIFIED:" + instant(event.updatedAt),
    event.allDay ? "DTSTART;VALUE=DATE:" + event.start.replaceAll("-", "") : "DTSTART:" + instant(event.start),
    event.allDay ? "DTEND;VALUE=DATE:" + event.end.replaceAll("-", "") : "DTEND:" + instant(event.end),
    "SUMMARY:" + escapeText(event.title), "URL:" + event.url, "END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
