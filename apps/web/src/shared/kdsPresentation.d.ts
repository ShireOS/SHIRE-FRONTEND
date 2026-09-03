export interface TicketAgeColors {
  normal: string
  warning: { after_seconds: number; color: string }
  late: { after_seconds: number; color: string }
  rush: string
}
export const DEFAULT_TICKET_AGE_COLORS: TicketAgeColors
export function normalizeTicketAgeColors(value: unknown): TicketAgeColors
export function isRushRed(value: unknown): boolean
export function ticketTimingError(colors: unknown, rushAfterSeconds: number): string
