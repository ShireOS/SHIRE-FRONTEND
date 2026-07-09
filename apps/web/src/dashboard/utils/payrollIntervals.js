const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n) => String(n).padStart(2, '0')

export function dateKeyOf(value = new Date()) {
  const d = value instanceof Date ? value : new Date(`${value}T00:00:00`)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDateKey(key) {
  return new Date(`${key}T00:00:00`)
}

export function addDays(value, days) {
  const d = value instanceof Date ? new Date(value) : parseDateKey(value)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(value, months) {
  const d = value instanceof Date ? new Date(value) : parseDateKey(value)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  return d
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function startOfWeek(value) {
  const d = value instanceof Date ? new Date(value) : parseDateKey(value)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function startOfMonth(value) {
  const d = value instanceof Date ? new Date(value) : parseDateKey(value)
  d.setHours(0, 0, 0, 0)
  d.setDate(1)
  return d
}

export function endOfMonth(value) {
  const d = startOfMonth(value)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return d
}

export function closedPayrollInterval(frequency = 'biweekly', today = new Date()) {
  const now = today instanceof Date ? today : parseDateKey(today)
  const todayKey = dateKeyOf(now)
  if (frequency === 'daily') {
    const d = addDays(now, -1)
    return { start: dateKeyOf(d), end: dateKeyOf(d), preset: 'day' }
  }
  if (frequency === 'weekly') {
    const end = addDays(startOfWeek(now), -1)
    const start = addDays(end, -6)
    return { start: dateKeyOf(start), end: dateKeyOf(end), preset: 'week' }
  }
  if (frequency === 'semimonthly') {
    const y = now.getFullYear()
    const m = now.getMonth()
    if (now.getDate() > 15) return { start: dateKeyOf(new Date(y, m, 1)), end: dateKeyOf(new Date(y, m, 15)), preset: 'pay_period' }
    const prev = new Date(y, m - 1, 1)
    return { start: dateKeyOf(new Date(prev.getFullYear(), prev.getMonth(), 16)), end: dateKeyOf(endOfMonth(prev)), preset: 'pay_period' }
  }
  if (frequency === 'monthly') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { start: dateKeyOf(startOfMonth(prev)), end: dateKeyOf(endOfMonth(prev)), preset: 'month' }
  }
  if (frequency === 'manual') {
    const end = addDays(now, -1)
    return { start: dateKeyOf(addDays(end, -6)), end: dateKeyOf(end), preset: 'custom' }
  }
  const end = addDays(startOfWeek(now), -1)
  return { start: dateKeyOf(addDays(end, -13)), end: dateKeyOf(end), preset: 'pay_period' }
}

export function currentBrowsingInterval(preset = 'week', today = new Date()) {
  const now = today instanceof Date ? today : parseDateKey(today)
  if (preset === 'day') return { start: dateKeyOf(now), end: dateKeyOf(now), preset }
  if (preset === 'month') return { start: dateKeyOf(startOfMonth(now)), end: dateKeyOf(endOfMonth(now)), preset }
  const start = startOfWeek(now)
  return { start: dateKeyOf(start), end: dateKeyOf(addDays(start, 6)), preset: 'week' }
}

export function intervalDays(interval) {
  const start = parseDateKey(interval.start)
  const end = parseDateKey(interval.end)
  const count = Math.max(1, Math.round((end - start) / DAY_MS) + 1)
  return Array.from({ length: count }, (_, i) => dateKeyOf(addDays(start, i)))
}

export function intervalLengthDays(interval) {
  return intervalDays(interval).length
}

export function shiftInterval(interval, preset, direction) {
  const start = parseDateKey(interval.start)
  const end = parseDateKey(interval.end)
  if (preset === 'day') {
    const next = addDays(start, direction)
    return { ...interval, start: dateKeyOf(next), end: dateKeyOf(next) }
  }
  if (preset === 'week') {
    return { ...interval, start: dateKeyOf(addDays(start, direction * 7)), end: dateKeyOf(addDays(end, direction * 7)) }
  }
  if (preset === 'month') {
    const next = addMonths(startOfMonth(start), direction)
    return { ...interval, start: dateKeyOf(startOfMonth(next)), end: dateKeyOf(endOfMonth(next)) }
  }
  const length = intervalLengthDays(interval)
  return { ...interval, start: dateKeyOf(addDays(start, direction * length)), end: dateKeyOf(addDays(end, direction * length)) }
}

export function setIntervalPreset(preset, current, payrollFrequency = 'biweekly') {
  if (preset === 'pay_period') return closedPayrollInterval(payrollFrequency)
  if (preset === 'day') return { ...current, start: dateKeyOf(new Date()), end: dateKeyOf(new Date()), preset }
  if (preset === 'week') return currentBrowsingInterval('week')
  if (preset === 'month') return currentBrowsingInterval('month')
  return { ...current, preset: 'custom' }
}

export function isSingleDay(interval) {
  return interval?.start === interval?.end
}

export function isoWindow(interval) {
  return {
    window_start: `${interval.start}T00:00:00`,
    window_end: `${interval.end}T23:59:59`,
  }
}

export function intervalLabel(interval) {
  if (!interval?.start || !interval?.end) return ''
  const fmt = { month: 'short', day: 'numeric' }
  const start = parseDateKey(interval.start)
  const end = parseDateKey(interval.end)
  if (interval.start === interval.end) return start.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })
  return `${start.toLocaleDateString('en-US', fmt)} - ${end.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })}`
}

export function normalizeInterval(start, end, preset = 'custom') {
  if (!start || !end) return currentBrowsingInterval('week')
  return start <= end ? { start, end, preset } : { start: end, end: start, preset }
}
