export function normalizeEmployeeNameConfirmation(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function employeeNameConfirmationMatches(confirmation, employeeName) {
  return normalizeEmployeeNameConfirmation(confirmation)
    === normalizeEmployeeNameConfirmation(employeeName)
}
