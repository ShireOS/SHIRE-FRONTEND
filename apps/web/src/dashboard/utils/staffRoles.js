const ROLE_ALIASES = Object.freeze({
  waiter: 'server',
})

const AUTHORITY_RANKS = Object.freeze({
  staff: 0,
  normal: 0,
  limited: 0,
  waiter: 0,
  server: 0,
  manager: 1,
  admin: 1,
  owner: 2,
  platform_admin: 3,
})

function storedRoleCode(value) {
  return String(value || '').trim().toLowerCase()
}

export function normalizeRoleCode(value) {
  const code = storedRoleCode(value)
  return ROLE_ALIASES[code] || code
}

export function roleCodeFromJobCode(jobCode) {
  return normalizeRoleCode(typeof jobCode === 'string' ? jobCode : jobCode?.code)
}

export function staffAuthorityRank(value) {
  return AUTHORITY_RANKS[String(value || 'staff').trim().toLowerCase()] ?? 0
}

export function jobCodeAuthority(jobCode) {
  return staffAuthorityRank(jobCode?.permission_tier || jobCode?.code)
}

export function canManageJobCode(authorityLevel, jobCode) {
  return staffAuthorityRank(authorityLevel) >= jobCodeAuthority(jobCode)
}

export function canManageStaffMember(authorityLevel, waiter, jobCodes = []) {
  const options = normalizeStaffRoleOptions(jobCodes)
  return assignedStaffRoles(waiter, options).every((role) => {
    const jobCode = options.find(option => roleCodeFromJobCode(option) === role)
    return canManageJobCode(authorityLevel, jobCode || { code: role, permission_tier: role })
  })
}

export function manageableTeamAccountTypes(
  authorityLevel,
  { isDirectReseller = false, canManageMembers = false } = {},
) {
  const types = ['employee']
  if (staffAuthorityRank(authorityLevel) >= staffAuthorityRank('manager')) {
    types.push('manager')
  }
  if (staffAuthorityRank(authorityLevel) >= staffAuthorityRank('owner') || (isDirectReseller && canManageMembers)) {
    types.push('owner', 'reseller')
  }
  return types
}

export function staffRoleLabel(jobCode) {
  const code = roleCodeFromJobCode(jobCode)
  if (code === 'server') return 'Server'
  const configured = typeof jobCode === 'string' ? '' : String(jobCode?.label || '').trim()
  return configured || code.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
}

// Waiter is a legacy synonym for Server. Prefer a real `server` catalog row
// when both exist, but keep a waiter-only row usable without a data migration.
export function normalizeStaffRoleOptions(jobCodes = []) {
  const options = []
  const indexes = new Map()

  jobCodes.forEach((jobCode) => {
    const rawCode = storedRoleCode(typeof jobCode === 'string' ? jobCode : jobCode?.code)
    const canonicalCode = normalizeRoleCode(rawCode)
    if (!canonicalCode) return

    const option = typeof jobCode === 'string'
      ? { id: null, code: rawCode, label: staffRoleLabel(jobCode) }
      : { ...jobCode, code: rawCode, label: staffRoleLabel(jobCode) }
    const existingIndex = indexes.get(canonicalCode)

    if (existingIndex === undefined) {
      indexes.set(canonicalCode, options.length)
      options.push(option)
      return
    }

    const existingRaw = storedRoleCode(options[existingIndex]?.code)
    if (existingRaw !== canonicalCode && rawCode === canonicalCode) {
      options[existingIndex] = option
    }
  })

  return options
}

export function defaultStaffRole(jobCodes = []) {
  const options = normalizeStaffRoleOptions(jobCodes)
  const server = options.find(option => roleCodeFromJobCode(option) === 'server')
  return roleCodeFromJobCode(server || options[0])
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
  const normalizedRoles = rawRoles.map(normalizeRoleCode).filter(Boolean)
  const storedPrimary = normalizeRoleCode(waiter?.role)
  const primaryRole = normalizedRoles.includes(storedPrimary)
    ? storedPrimary
    : normalizedRoles[0] || storedPrimary
  return normalizeStaffRoles(rawRoles, primaryRole, jobCodes)
}

export function primaryStaffRole(waiter, jobCodes = []) {
  const roles = assignedStaffRoles(waiter, jobCodes)
  return roles[0] || roleCodeFromJobCode(jobCodes[0]) || ''
}

export function buildStaffRoleUpdate(primaryRole, roles, jobCodes = []) {
  const options = normalizeStaffRoleOptions(jobCodes)
  const normalized = normalizeStaffRoles(roles, primaryRole, options)
  const primary = normalized.includes(normalizeRoleCode(primaryRole))
    ? normalizeRoleCode(primaryRole)
    : normalized[0] || defaultStaffRole(options) || ''
  const assignedRoles = normalizeStaffRoles(normalized, primary, options)
  const jobCode = options.find(code => roleCodeFromJobCode(code) === primary)
  const persistedCode = (code) => {
    const option = options.find(candidate => roleCodeFromJobCode(candidate) === code)
    return storedRoleCode(option?.code) || code
  }

  return {
    role: persistedCode(primary),
    roles: assignedRoles.map(persistedCode),
    job_code_id: jobCode?.id || null,
  }
}
