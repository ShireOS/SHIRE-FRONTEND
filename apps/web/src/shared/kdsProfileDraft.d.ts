export const KDS_METADATA_FIELDS: Array<[string, string]>
export function emptyKdsConfiguration(): any
export function blankKdsProfile(stations: any[], profileDefaults?: any): any
export function normalizeKdsProfile(profile: any, profileDefaults?: any): any
export function kdsProfilePayload(draft: any, reason: string): Record<string, unknown>
