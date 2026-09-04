export interface OperatingHourReplacementRow {
  day_of_week: number
  open_time: string | null
  close_time: string | null
  is_closed: boolean
}

export function operatingHoursReplacementPayload(
  rows: OperatingHourReplacementRow[],
): { hours: OperatingHourReplacementRow[] }
