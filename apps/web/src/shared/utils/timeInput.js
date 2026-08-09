const MINUTES_PER_DAY = 24 * 60

const pad = (value) => String(value).padStart(2, '0')

export function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] || 0)
  if (hours > 23 || minutes > 59 || seconds !== 0) return null
  return hours * 60 + minutes
}

export function minutesToTime(value) {
  const normalized = ((Number(value) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`
}

export function formatTimeLabel(value) {
  const total = timeToMinutes(value)
  if (total == null) return ''
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${pad(minutes)} ${period}`
}

export function parseTimeQuery(input) {
  let query = String(input || '').trim().toLowerCase().replace(/\./g, '')
  if (!query) return null
  if (query === 'noon') return '12:00'
  if (query === 'midnight') return '00:00'

  const periodMatch = query.match(/(am|pm|a|p)$/)
  const period = periodMatch?.[1]?.startsWith('p') ? 'pm' : periodMatch ? 'am' : null
  if (periodMatch) query = query.slice(0, -periodMatch[0].length)
  query = query.replace(/\s+/g, '')

  let hours
  let minutes
  if (/^\d{1,2}:\d{1,2}$/.test(query)) {
    const parts = query.split(':')
    hours = Number(parts[0])
    minutes = Number(parts[1])
  } else if (/^\d{1,4}$/.test(query)) {
    if (query.length <= 2) {
      hours = Number(query)
      minutes = 0
    } else {
      hours = Number(query.slice(0, -2))
      minutes = Number(query.slice(-2))
    }
  } else {
    return null
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null
  if (period) {
    if (hours < 1 || hours > 12) return null
    hours = (hours % 12) + (period === 'pm' ? 12 : 0)
  } else if (hours > 23) {
    return null
  }

  return minutesToTime(hours * 60 + minutes)
}

export function isTimeOnStep(value, minuteStep = 15) {
  const total = timeToMinutes(value)
  return total != null && total % minuteStep === 0
}

export function snapTimeToStep(value, minuteStep = 15) {
  const total = timeToMinutes(value)
  if (total == null) return null
  return minutesToTime(Math.round(total / minuteStep) * minuteStep)
}

function aliasesFor(value) {
  const total = timeToMinutes(value)
  if (total == null) return []
  const hours24 = Math.floor(total / 60)
  const minutes = total % 60
  const hours12 = hours24 % 12 || 12
  const period = hours24 >= 12 ? 'pm' : 'am'
  const minuteText = pad(minutes)
  return [
    `${hours12}${minuteText}${period}`,
    `${hours12}${minuteText}${period[0]}`,
    `${hours12}:${minuteText}${period}`,
    `${hours12}:${minuteText}${period[0]}`,
    `${pad(hours24)}${minuteText}`,
    `${hours24}:${minuteText}`,
    minutes === 0 ? `${hours12}${period}` : '',
    minutes === 0 ? `${hours12}${period[0]}` : '',
  ].filter(Boolean)
}

const compact = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

function textScore(query, aliases) {
  if (!query) return 0
  let best = Number.POSITIVE_INFINITY
  for (const alias of aliases) {
    const normalized = compact(alias)
    if (normalized === query) best = Math.min(best, 0)
    else if (normalized.startsWith(query)) best = Math.min(best, 10 + normalized.length - query.length)
    else if (normalized.includes(query)) best = Math.min(best, 30 + normalized.indexOf(query))
  }
  return Number.isFinite(best) ? best : 100
}

export function getTimeSuggestions({ query = '', value = '', minuteStep = 15 } = {}) {
  const suggestionStep = minuteStep === 1 ? 15 : minuteStep
  const options = []
  for (let minute = 0; minute < MINUTES_PER_DAY; minute += suggestionStep) {
    options.push(minutesToTime(minute))
  }

  const parsed = parseTimeQuery(query)
  const resolved = parsed && (minuteStep === 1 ? parsed : snapTimeToStep(parsed, minuteStep))
  if (resolved && !options.includes(resolved)) options.push(resolved)
  if (value && timeToMinutes(value) != null && !options.includes(value.slice(0, 5))) options.push(value.slice(0, 5))

  const normalizedQuery = compact(query)
  const parsedMinutes = parsed ? timeToMinutes(parsed) : null
  return options
    .map((option) => {
      const optionMinutes = timeToMinutes(option)
      const direct = textScore(normalizedQuery, aliasesFor(option))
      const distance = parsedMinutes == null || optionMinutes == null
        ? 0
        : Math.min(Math.abs(optionMinutes - parsedMinutes), MINUTES_PER_DAY - Math.abs(optionMinutes - parsedMinutes))
      return {
        value: option,
        label: formatTimeLabel(option),
        score: direct * 100 + distance,
      }
    })
    .sort((left, right) => left.score - right.score || timeToMinutes(left.value) - timeToMinutes(right.value))
}
