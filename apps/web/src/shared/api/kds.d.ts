export function fetchKdsConfiguration(restaurantId: string, signal?: AbortSignal): Promise<any>
export function createKdsProfile(restaurantId: string, profile: Record<string, unknown>): Promise<any>
export function updateKdsProfile(restaurantId: string, profileId: string, profile: Record<string, unknown>): Promise<any>
export function assignKdsDevice(restaurantId: string, deviceId: string, profileId: string, reason: string): Promise<any>
