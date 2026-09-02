export interface StaffPayDraft {
  job_code_id: string | null
  code: string
  label: string
  permission_tier: string
  default_hourly_rate: number | null
  selected: boolean
  is_primary: boolean
  use_custom_rate: boolean
  hourly_rate_override: string
  is_active: boolean
}

export function newStaffPayDrafts(jobCodes?: unknown[], preferredRole?: string): StaffPayDraft[]
export function staffPayDrafts(waiter: unknown, jobCodes?: unknown[]): StaffPayDraft[]
export function staffPayPayload(rows?: StaffPayDraft[]): Array<{
  job_code_id: string | null
  code: string
  is_primary: boolean
  hourly_rate_override: number | null
}>
export function validateStaffPayDrafts(rows?: StaffPayDraft[]): string | null
export function effectiveStaffPayRate(row: StaffPayDraft): number | null
