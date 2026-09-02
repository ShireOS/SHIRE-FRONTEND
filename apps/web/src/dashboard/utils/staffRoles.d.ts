export function normalizeRoleCode(value: unknown): string
export function canManageJobCode(authorityLevel: unknown, jobCode: unknown): boolean
export function canManageStaffMember(
  authorityLevel: unknown,
  waiter: unknown,
  jobCodes?: unknown[],
): boolean
export function manageableTeamAccountTypes(
  authorityLevel: unknown,
  options?: { isDirectReseller?: boolean; canManageMembers?: boolean },
): Array<'employee' | 'manager' | 'owner' | 'reseller'>
