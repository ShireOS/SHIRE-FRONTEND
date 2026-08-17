import {
  assignedStaffRoles,
  normalizeRoleCode,
  normalizeStaffRoleOptions,
  primaryStaffRole,
  roleCodeFromJobCode,
  staffRoleLabel,
} from './staffRoles.js'

const hasValue = value => value !== null && value !== undefined && value !== ''

const finiteRate = value => {
  if (!hasValue(value)) return null
  const text = String(value).trim()
  if (!/^\d+(?:\.\d{0,2})?$/.test(text)) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 99999999.99 ? parsed : null
}

export function staffPayDrafts(waiter, jobCodes = []) {
  const assignments = Array.isArray(waiter?.job_assignments) ? waiter.job_assignments : []
  const hasStructuredAssignments = assignments.length > 0
  const options = normalizeStaffRoleOptions(jobCodes)
  const assignedRoles = assignedStaffRoles(waiter, options)
  const legacyPrimary = primaryStaffRole(waiter, options)

  assignments.forEach(assignment => {
    const assignmentRole = normalizeRoleCode(assignment?.code)
    const exists = options.some(option => (
      (assignment?.job_code_id && option?.id === assignment.job_code_id)
      || roleCodeFromJobCode(option) === assignmentRole
    ))
    if (!exists) options.push({
      id: assignment?.job_code_id || null,
      code: assignment?.code,
      label: assignment?.label,
      permission_tier: assignment?.permission_tier,
      default_hourly_rate: assignment?.default_hourly_rate,
      is_active: assignment?.is_active,
    })
  })

  return options.map(option => {
    const role = roleCodeFromJobCode(option)
    const assignment = assignments.find(item => (
      (item?.job_code_id && option?.id === item.job_code_id)
      || normalizeRoleCode(item?.code) === role
    ))
    const selected = Boolean(assignment) || (!hasStructuredAssignments && assignedRoles.includes(role))
    const isPrimary = assignment
      ? Boolean(assignment.is_primary)
      : selected && role === legacyPrimary
    const legacyOverride = !hasStructuredAssignments && isPrimary ? waiter?.hourly_rate : null
    const override = assignment?.hourly_rate_override ?? legacyOverride
    const defaultRate = finiteRate(assignment?.default_hourly_rate ?? option?.default_hourly_rate)

    return {
      job_code_id: assignment?.job_code_id || option?.id || null,
      code: String(assignment?.code || option?.code || '').trim().toLowerCase(),
      label: assignment?.label || staffRoleLabel(option),
      permission_tier: assignment?.permission_tier || option?.permission_tier || 'normal',
      default_hourly_rate: defaultRate,
      selected,
      is_primary: isPrimary,
      use_custom_rate: hasValue(override),
      hourly_rate_override: hasValue(override) ? String(override) : '',
      is_active: assignment?.is_active ?? option?.is_active ?? true,
    }
  })
}

export function newStaffPayDrafts(jobCodes = [], preferredRole = '') {
  const rows = staffPayDrafts(null, jobCodes)
  const preferred = normalizeRoleCode(preferredRole)
  const primaryIndex = preferred
    ? rows.findIndex(row => normalizeRoleCode(row.code) === preferred)
    : -1
  return rows.map((row, index) => ({
    ...row,
    selected: index === primaryIndex,
    is_primary: index === primaryIndex,
  }))
}

export function effectiveStaffPayRate(row) {
  if (row?.use_custom_rate) return finiteRate(row.hourly_rate_override)
  return finiteRate(row?.default_hourly_rate)
}

export function validateStaffPayDrafts(rows = []) {
  const selected = rows.filter(row => row.selected)
  if (selected.length === 0) return 'Choose at least one position.'
  if (selected.filter(row => row.is_primary).length !== 1) return 'Choose exactly one primary position.'
  if (selected.some(row => !row.job_code_id)) return 'Every selected position must be saved before assignment.'
  if (selected.some(row => row.use_custom_rate && finiteRate(row.hourly_rate_override) === null)) {
    return 'Enter a valid custom hourly rate.'
  }
  return null
}

export function staffPayPayload(rows = []) {
  return rows
    .filter(row => row.selected)
    .map(row => ({
      job_code_id: row.job_code_id,
      code: row.code,
      is_primary: Boolean(row.is_primary),
      hourly_rate_override: row.use_custom_rate ? finiteRate(row.hourly_rate_override) : null,
    }))
}
