export const WORKWEEK_START_DAY_OPTIONS = Object.freeze([
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
])

export function normalizeWorkweekStartWeekday(value) {
  if (value == null || typeof value === 'boolean') return 0
  if (typeof value !== 'number' && typeof value !== 'string') return 0
  if (typeof value === 'string' && value.trim() === '') return 0
  const weekday = Number(value)
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 0
}
