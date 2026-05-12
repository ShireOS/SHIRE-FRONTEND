// Reservation Configuration API Functions
// Handles service periods, pacing rules, booking channels, and blackouts

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import { API_CONFIG } from './config'
import type {
  ReservationSettings,
  ReservationBlackout,
  ReservationBlackoutCreate,
  ReservationBlackoutUpdate,
  DayOfWeek,
  BookingChannel,
} from '../types/api'

type BackendReservationChannel = 'host' | 'phone' | 'public_web' | 'public_app'

interface BackendServicePeriod {
  id?: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string
  slotIntervalMinutes: number
  leadTimeMinutes: number
  sameDayCutoffTime: string | null
  minPartySize: number
  maxPartySize: number
  defaultDurationMinutes: number
  active: boolean
}

interface BackendPacingRule {
  id?: string
  servicePeriodId: string | null
  channel: BackendReservationChannel | null
  windowMinutes: number
  maxCovers: number
  active: boolean
}

interface BackendChannelRule {
  id?: string
  servicePeriodId: string | null
  channel: BackendReservationChannel
  isEnabled: boolean
}

interface BackendReservationSettings {
  restaurantId: string
  bookingHorizonDays: number
  gracePeriodMinutes: number
  defaultSlotIntervalMinutes: number
  servicePeriods: BackendServicePeriod[]
  pacingRules: BackendPacingRule[]
  channelRules: BackendChannelRule[]
  createdAt: string
  updatedAt: string
}

interface BackendReservationBlackout {
  id: string
  restaurantId: string
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  servicePeriodId: string | null
  channels: BackendReservationChannel[]
  reason: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

interface BackendReservationBlackoutListResponse {
  blackouts: BackendReservationBlackout[]
}

export interface ReservationChannelConnection {
  redirectBookingUrl: string
  connectionStatus: 'connected' | 'disconnected' | 'pending' | string
  updatedAt?: string
}

export interface PublicBookableLocation {
  locationId: string
  slug?: string
  name?: string
  displayName?: string
  restaurantName?: string
  timezone?: string
  address?: string
  phone?: string
}

export interface PublicBookingConfig {
  locationId?: string
  minPartySize?: number
  maxPartySize?: number
  publicMinPartySize?: number
  publicMaxPartySize?: number
  bookingHorizonDays?: number
  defaultPartySize?: number
  timezone?: string
  restaurantName?: string
  name?: string
}

export interface PublicAvailabilitySlot {
  id?: string
  time?: string
  startTime?: string
  reservationTime?: string
  available?: boolean
  remainingCovers?: number
  label?: string
}

export interface PublicReservationCreate {
  guestName: string
  guestPhone: string
  guestEmail?: string
  partySize: number
  serviceDate: string
  reservationTime: string
  source: 'google_business_profile' | 'public_web'
}

export interface PublicReservation {
  id?: string
  reservationId?: string
  confirmationCode?: string
  status?: string
  guestName?: string
  partySize?: number
  serviceDate?: string
  reservationTime?: string
}

const unwrapAvailabilitySlots = (response: unknown): PublicAvailabilitySlot[] => {
  if (Array.isArray(response)) return response as PublicAvailabilitySlot[]
  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>
    if (Array.isArray(record.slots)) return record.slots as PublicAvailabilitySlot[]
    if (Array.isArray(record.availability)) return record.availability as PublicAvailabilitySlot[]
    if (Array.isArray(record.availableSlots)) return record.availableSlots as PublicAvailabilitySlot[]
  }
  return []
}

const DAY_NAMES: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const BACKEND_TO_UI_CHANNEL: Record<BackendReservationChannel, BookingChannel> = {
  host: 'host',
  phone: 'phone',
  public_web: 'web',
  public_app: 'app',
}

const UI_TO_BACKEND_CHANNEL: Record<BookingChannel, BackendReservationChannel> = {
  host: 'host',
  phone: 'phone',
  web: 'public_web',
  app: 'public_app',
}

const normalizeTime = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value.split(':').slice(0, 2).join(':')
}

const toBackendTime = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value.length === 5 ? `${value}:00` : value
}

const mapDayNumberToName = (value: number): DayOfWeek => DAY_NAMES[value] ?? 'monday'

const toUiChannel = (value: BackendReservationChannel | null | undefined): BookingChannel | null => {
  if (!value) return null
  return BACKEND_TO_UI_CHANNEL[value] ?? null
}

const toBackendChannel = (value: BookingChannel | null | undefined): BackendReservationChannel | null => {
  if (!value) return null
  return UI_TO_BACKEND_CHANNEL[value] ?? null
}

const toUiSettings = (settings: BackendReservationSettings): ReservationSettings => {
  const groupedPeriods = new Map<string, ReservationSettings['service_periods'][number]>()

  for (const period of settings.servicePeriods || []) {
    const dayName = mapDayNumberToName(period.dayOfWeek)
    const key = [
      period.name,
      period.startTime,
      period.endTime,
      period.slotIntervalMinutes,
      period.leadTimeMinutes,
      period.sameDayCutoffTime ?? '',
      period.minPartySize,
      period.maxPartySize,
      period.defaultDurationMinutes,
      period.active,
    ].join('|')

    const existing = groupedPeriods.get(key)
    if (existing) {
      existing.days_of_week = [...existing.days_of_week, dayName]
      existing.backend_period_ids = {
        ...(existing.backend_period_ids || {}),
        [dayName]: period.id || '',
      }
      continue
    }

    groupedPeriods.set(key, {
      id: period.id || `${period.name}-${dayName}`,
      name: period.name,
      days_of_week: [dayName],
      start_time: normalizeTime(period.startTime) || '17:00',
      end_time: normalizeTime(period.endTime) || '22:00',
      slot_interval_minutes: period.slotIntervalMinutes,
      lead_time_hours: Math.round(period.leadTimeMinutes / 60),
      cutoff_time: normalizeTime(period.sameDayCutoffTime),
      min_party_size: period.minPartySize,
      max_party_size: period.maxPartySize,
      is_active: period.active,
      default_duration_minutes: period.defaultDurationMinutes,
      backend_period_ids: {
        [dayName]: period.id || '',
      },
    })
  }

  return {
    location_id: settings.restaurantId,
    service_periods: Array.from(groupedPeriods.values()),
    pacing_rules: (settings.pacingRules || []).map(rule => ({
      id: rule.id || `pace-${rule.windowMinutes}-${rule.maxCovers}`,
      window_minutes: rule.windowMinutes,
      max_covers_per_window: rule.maxCovers,
      service_period_id: rule.servicePeriodId,
      channel: toUiChannel(rule.channel),
      is_active: rule.active,
    })),
    channel_rules: (settings.channelRules || []).map(rule => ({
      id: rule.id,
      service_period_id: rule.servicePeriodId,
      channel: toUiChannel(rule.channel) || 'host',
      is_enabled: rule.isEnabled,
    })),
    default_slot_interval_minutes: settings.defaultSlotIntervalMinutes,
    default_min_party_size:
      Math.min(...(settings.servicePeriods || []).map(period => period.minPartySize)) || 1,
    default_max_party_size:
      Math.max(...(settings.servicePeriods || []).map(period => period.maxPartySize)) || 10,
    auto_confirm: false,
    confirmation_lead_hours: Math.round((settings.gracePeriodMinutes || 0) / 60) || 24,
    booking_horizon_days: settings.bookingHorizonDays,
    grace_period_minutes: settings.gracePeriodMinutes,
    updated_at: settings.updatedAt,
  }
}

const toBackendSettings = (
  settings: Partial<ReservationSettings>
): Record<string, unknown> => {
  const servicePeriods = (settings.service_periods || []).flatMap(period =>
    (period.days_of_week || []).map(day => ({
      id: period.backend_period_ids?.[day],
      name: period.name,
      dayOfWeek: DAY_NAMES.indexOf(day),
      startTime: toBackendTime(period.start_time) || '17:00:00',
      endTime: toBackendTime(period.end_time) || '22:00:00',
      slotIntervalMinutes: period.slot_interval_minutes,
      leadTimeMinutes: Math.max(0, Math.round((period.lead_time_hours || 0) * 60)),
      sameDayCutoffTime: toBackendTime(period.cutoff_time),
      minPartySize: period.min_party_size,
      maxPartySize: period.max_party_size,
      defaultDurationMinutes: period.default_duration_minutes || 90,
      active: period.is_active,
    }))
  )

  return {
    bookingHorizonDays: settings.booking_horizon_days || 30,
    gracePeriodMinutes: settings.grace_period_minutes || 15,
    defaultSlotIntervalMinutes: settings.default_slot_interval_minutes || 15,
    servicePeriods,
    pacingRules: (settings.pacing_rules || []).map(rule => ({
      id: rule.id,
      servicePeriodId: rule.service_period_id || null,
      channel: toBackendChannel(rule.channel),
      windowMinutes: rule.window_minutes,
      maxCovers: rule.max_covers_per_window,
      active: rule.is_active ?? true,
    })),
    channelRules: (settings.channel_rules || []).map(rule => ({
      id: rule.id,
      servicePeriodId: rule.service_period_id || null,
      channel: toBackendChannel(rule.channel) || 'host',
      isEnabled: rule.is_enabled,
    })),
  }
}

const toUiBlackout = (blackout: BackendReservationBlackout): ReservationBlackout => {
  const channels = (blackout.channels || [])
    .map(channel => toUiChannel(channel))
    .filter(Boolean) as BookingChannel[]
  const startTime = normalizeTime(blackout.startTime)
  const endTime = normalizeTime(blackout.endTime)

  return {
    id: blackout.id,
    location_id: blackout.restaurantId,
    date: blackout.startDate,
    start_date: blackout.startDate,
    end_date: blackout.endDate,
    scope: startTime || endTime ? 'partial' : 'full_day',
    start_time: startTime,
    end_time: endTime,
    reason: blackout.reason || '',
    status: blackout.active ? 'active' : 'cancelled',
    active: blackout.active,
    service_period_id: blackout.servicePeriodId,
    channels,
    created_at: blackout.createdAt,
    updated_at: blackout.updatedAt,
  }
}

const toBackendBlackoutCreate = (blackout: ReservationBlackoutCreate) => ({
  startDate: blackout.start_date || blackout.date,
  endDate: blackout.end_date || blackout.start_date || blackout.date,
  startTime: blackout.scope === 'partial' ? toBackendTime(blackout.start_time) : null,
  endTime: blackout.scope === 'partial' ? toBackendTime(blackout.end_time) : null,
  servicePeriodId: blackout.service_period_id || null,
  channels: (blackout.channels || []).map(channel => toBackendChannel(channel)).filter(Boolean),
  reason: blackout.reason,
  active: true,
})

const toBackendBlackoutUpdate = (updates: ReservationBlackoutUpdate) => {
  const payload: Record<string, unknown> = {}

  if (updates.start_date || updates.date) {
    payload.startDate = updates.start_date || updates.date
  }
  if (updates.end_date || updates.date) {
    payload.endDate = updates.end_date || updates.start_date || updates.date
  }
  if (updates.reason !== undefined) {
    payload.reason = updates.reason
  }
  if (updates.scope) {
    if (updates.scope === 'full_day') {
      payload.startTime = null
      payload.endTime = null
    } else {
      payload.startTime = toBackendTime(updates.start_time)
      payload.endTime = toBackendTime(updates.end_time)
    }
  } else {
    if (updates.start_time !== undefined) {
      payload.startTime = toBackendTime(updates.start_time)
    }
    if (updates.end_time !== undefined) {
      payload.endTime = toBackendTime(updates.end_time)
    }
  }
  if (updates.service_period_id !== undefined) {
    payload.servicePeriodId = updates.service_period_id
  }
  if (updates.channels !== undefined) {
    payload.channels = updates.channels.map(channel => toBackendChannel(channel)).filter(Boolean)
  }
  if (updates.status !== undefined) {
    payload.active = updates.status === 'active'
  }

  return payload
}

export const reservationApi = {
  /**
   * Get reservation settings for a location
   */
  getSettings: async (locationId?: string): Promise<ReservationSettings> => {
    const id = locationId || API_CONFIG.restaurantId
    const response = await apiClient.get<BackendReservationSettings>(ENDPOINTS.reservationSettings(id))
    return toUiSettings(response)
  },

  /**
   * Update reservation settings (full replace)
   */
  updateSettings: async (
    settings: Partial<ReservationSettings>,
    locationId?: string
  ): Promise<ReservationSettings> => {
    const id = locationId || API_CONFIG.restaurantId
    const response = await apiClient.put<BackendReservationSettings>(
      ENDPOINTS.reservationSettings(id),
      toBackendSettings(settings)
    )
    return toUiSettings(response)
  },

  /**
   * Get all blackouts for a location
   */
  getBlackouts: async (locationId?: string): Promise<ReservationBlackout[]> => {
    const id = locationId || API_CONFIG.restaurantId
    const response = await apiClient.get<BackendReservationBlackoutListResponse>(
      ENDPOINTS.reservationBlackouts(id)
    )
    return (response.blackouts || []).map(toUiBlackout)
  },

  /**
   * Create a new blackout
   */
  createBlackout: async (
    blackout: ReservationBlackoutCreate,
    locationId?: string
  ): Promise<ReservationBlackout> => {
    const id = locationId || API_CONFIG.restaurantId
    const response = await apiClient.post<BackendReservationBlackout>(
      ENDPOINTS.reservationBlackouts(id),
      toBackendBlackoutCreate(blackout)
    )
    return toUiBlackout(response)
  },

  /**
   * Update a blackout (e.g. cancel it)
   */
  updateBlackout: async (
    blackoutId: string,
    updates: ReservationBlackoutUpdate,
    locationId?: string
  ): Promise<ReservationBlackout> => {
    const id = locationId || API_CONFIG.restaurantId
    const response = await apiClient.patch<BackendReservationBlackout>(
      ENDPOINTS.reservationBlackout(id, blackoutId),
      toBackendBlackoutUpdate(updates)
    )
    return toUiBlackout(response)
  },

  getGoogleConnection: async (locationId: string): Promise<ReservationChannelConnection> => {
    return apiClient.get<ReservationChannelConnection>(
      ENDPOINTS.reservationChannelConnection(locationId, 'google')
    )
  },

  updateGoogleConnection: async (
    locationId: string,
    payload: ReservationChannelConnection
  ): Promise<ReservationChannelConnection> => {
    return apiClient.put<ReservationChannelConnection>(
      ENDPOINTS.reservationChannelConnection(locationId, 'google'),
      payload
    )
  },

  getPublicBookableLocation: async (slug: string): Promise<PublicBookableLocation> => {
    return apiClient.get<PublicBookableLocation>(ENDPOINTS.publicBookableLocation(slug))
  },

  getPublicBookingConfig: async (locationId: string): Promise<PublicBookingConfig> => {
    return apiClient.get<PublicBookingConfig>(ENDPOINTS.publicBookingConfig(locationId))
  },

  getPublicAvailability: async (
    locationId: string,
    serviceDate: string,
    partySize: number,
    channel = 'google'
  ): Promise<PublicAvailabilitySlot[]> => {
    const response = await apiClient.get<unknown>(
      ENDPOINTS.publicAvailability(locationId, serviceDate, partySize, channel)
    )
    return unwrapAvailabilitySlots(response)
  },

  createPublicReservation: async (
    locationId: string,
    payload: PublicReservationCreate
  ): Promise<PublicReservation> => {
    return apiClient.post<PublicReservation>(ENDPOINTS.publicReservations(locationId), payload)
  },
}
