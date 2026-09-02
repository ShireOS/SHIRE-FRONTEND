export type PosAuthority = 'normal' | 'waiter' | 'manager'
export const POS_AUTHORITY_OPTIONS: Array<{ value: PosAuthority; label: string }>
export const POS_AUTHORITY_RANK: Record<PosAuthority, number>
export function posAuthorityForTier(value: unknown): PosAuthority
export function highestPosAuthority(...values: unknown[]): PosAuthority
export function accountMinimumPosAuthority(role: unknown): PosAuthority
export function posAuthorityLabel(value: unknown): string
