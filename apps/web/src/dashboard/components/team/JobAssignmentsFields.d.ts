import type { ComponentType } from 'react'
import type { StaffPayDraft } from '../../utils/staffPay'

declare const JobAssignmentsFields: ComponentType<{
  rows: StaffPayDraft[]
  onChange: (rows: StaffPayDraft[]) => void
  disabled?: boolean
}>
export default JobAssignmentsFields
