const MINUTES_PER_DAY = 24 * 60;

const pad = (value: number) => String(value).padStart(2, '0');

export function timeToMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds !== 0) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(value: number): string {
  const normalized = ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

export function formatTimeLabel(value: string | null | undefined): string {
  const total = timeToMinutes(String(value || '').slice(0, 5));
  if (total == null) return '';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours % 12 || 12}:${pad(minutes)} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function parseTimeQuery(input: string): string | null {
  let query = String(input || '').trim().toLowerCase().replace(/\./g, '');
  if (!query) return null;
  if (query === 'noon') return '12:00';
  if (query === 'midnight') return '00:00';

  const periodMatch = query.match(/(am|pm|a|p)$/);
  const period = periodMatch?.[1]?.startsWith('p') ? 'pm' : periodMatch ? 'am' : null;
  if (periodMatch) query = query.slice(0, -periodMatch[0].length);
  query = query.replace(/\s+/g, '');

  let hours: number;
  let minutes: number;
  if (/^\d{1,2}:\d{1,2}$/.test(query)) {
    [hours, minutes] = query.split(':').map(Number);
  } else if (/^\d{1,4}$/.test(query)) {
    hours = Number(query.length <= 2 ? query : query.slice(0, -2));
    minutes = query.length <= 2 ? 0 : Number(query.slice(-2));
  } else {
    return null;
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
  if (period) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (period === 'pm' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return minutesToTime(hours * 60 + minutes);
}

export function resolveTimeInput(input: string, minuteStep: number): string | null {
  const parsed = parseTimeQuery(input);
  const total = parsed ? timeToMinutes(parsed) : null;
  if (total == null) return null;
  return minuteStep === 1 ? parsed : minutesToTime(Math.round(total / minuteStep) * minuteStep);
}

export function nearbyTimeSuggestions(input: string, minuteStep: number, count = 5): string[] {
  const parsed = parseTimeQuery(input);
  const total = parsed ? timeToMinutes(parsed) : null;
  if (minuteStep === 1 && total != null) {
    const cleanAnchor = Math.round(total / 15) * 15;
    return Array.from(new Set([
      minutesToTime(total),
      ...Array.from({ length: count }, (_, index) => minutesToTime(cleanAnchor + index * 15)),
    ])).slice(0, count);
  }
  const anchor = total == null ? 0 : Math.round(total / minuteStep) * minuteStep;
  return Array.from({ length: count }, (_, index) => minutesToTime(anchor + index * minuteStep));
}
