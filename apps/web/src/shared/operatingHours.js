const REQUIRED_DAY_COUNT = 7

export function operatingHoursReplacementPayload(rows) {
  if (!Array.isArray(rows) || rows.length !== REQUIRED_DAY_COUNT) {
    throw new Error('Operating hours must include all seven days before they can be saved.')
  }

  const days = new Set()
  const hours = rows.map((row) => {
    const day = row?.day_of_week
    if (!Number.isInteger(day) || day < 0 || day >= REQUIRED_DAY_COUNT || days.has(day)) {
      throw new Error('Operating hours must include each day exactly once.')
    }
    days.add(day)
    return {
      day_of_week: day,
      open_time: row.open_time ?? null,
      close_time: row.close_time ?? null,
      is_closed: row.is_closed === true,
    }
  })

  return { hours: hours.sort((left, right) => left.day_of_week - right.day_of_week) }
}
