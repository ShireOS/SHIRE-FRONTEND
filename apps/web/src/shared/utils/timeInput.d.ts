export type TimeSuggestion = {
  value: string
  label: string
  score: number
}

export function timeToMinutes(value: unknown): number | null
export function minutesToTime(value: number): string
export function formatTimeLabel(value: unknown): string
export function parseTimeQuery(input: unknown): string | null
export function isTimeOnStep(value: unknown, minuteStep?: number): boolean
export function snapTimeToStep(value: unknown, minuteStep?: number): string | null
export function getTimeSuggestions(options?: {
  query?: string
  value?: string
  minuteStep?: number
}): TimeSuggestion[]
