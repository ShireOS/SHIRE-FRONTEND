export function normalizeRoleCode(value) {
  return String(value || '').trim().toLowerCase()
}

export function roleCodeFromJobCode(jobCode) {
  return normalizeRoleCode(typeof jobCode === 'string' ? jobCode : jobCode?.code)
}

export function normalizeStaffRoles(values, primaryRole = '', jobCodes = []) {
  const availableCodes = new Set(jobCodes.map(roleCodeFromJobCode).filter(Boolean))
  const rawRoles = []

  ;[primaryRole, ...(Array.isArray(values) ? values : [])].forEach(value => {
    const code = normalizeRoleCode(value)
    if (!code) return
    if (!rawRoles.includes(code)) rawRoles.push(code)
  })

  if (availableCodes.size === 0) return rawRoles

  const knownRoles = rawRoles.filter(code => availableCodes.has(code))
  return knownRoles.length > 0 ? knownRoles : rawRoles
}

export function assignedStaffRoles(waiter, jobCodes = []) {
  const rawRoles = Array.isArray(waiter?.roles) ? waiter.roles : []
  const primaryRole = waiter?.pos_role || waiter?.role || rawRoles[0] || ''
  return normalizeStaffRoles(rawRoles, primaryRole, jobCodes)
}

export function primaryStaffRole(waiter, jobCodes = []) {
  const roles = assignedStaffRoles(waiter, jobCodes)
  return roles[0] || roleCodeFromJobCode(jobCodes[0]) || ''
}

export function buildStaffRoleUpdate(primaryRole, roles, jobCodes = []) {
  const normalized = normalizeStaffRoles(roles, primaryRole, jobCodes)
  const primary = normalized.includes(normalizeRoleCode(primaryRole))
    ? normalizeRoleCode(primaryRole)
    : normalized[0] || roleCodeFromJobCode(jobCodes[0]) || ''
  const assignedRoles = normalizeStaffRoles(normalized, primary, jobCodes)
  const jobCode = jobCodes.find(code => roleCodeFromJobCode(code) === primary)

  return {
    role: primary,
    pos_role: primary,
    roles: assignedRoles,
    job_code_id: jobCode?.id || null,
  }
}
