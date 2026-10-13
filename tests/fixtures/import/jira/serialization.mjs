import { MONTHS } from './data.mjs';
export function issueKey(index, prefix) {
  return `${prefix}-${index + 1}`;
}

export function formatDate(index, variant, withTime = true) {
  if (variant === 'ambiguous-numeric-dates') {
    const day = 1 + (index % 12);
    const month = 1 + (Math.floor(index / 12) % 12);
    const year = 2025 + Math.floor(index / 144);
    const calendar = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    return withTime ? `${calendar} 09:00+10:00` : calendar;
  }

  const date = new Date(Date.UTC(2025, 0, 1 + index));
  const calendar = `${String(date.getUTCDate()).padStart(2, '0')}/${MONTHS[date.getUTCMonth()]}/${date.getUTCFullYear()}`;
  return withTime ? `${calendar} 09:00+10:00` : calendar;
}

export function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
