import { DEFAULT_TICKET_AGE_COLORS, normalizeTicketAgeColors } from './kdsPresentation'

export const KDS_METADATA_FIELDS = [
  ['table_number', 'Table / tab'], ['guest_name', 'Guest name'], ['waiter_name', 'Server'],
  ['order_channel', 'Order method'], ['course', 'Course'], ['seat', 'Seat'], ['descriptions', 'Item descriptions in details'],
]

export const emptyKdsConfiguration = () => ({ profiles: [], stations: [], devices: [], display_groups: [], metrics: {}, profile_defaults: null })

export function blankKdsProfile(stations, profileDefaults = null) {
  const first = stations.find(station => station.station_type !== 'expo')
  if (!first) return null
  const defaults = profileDefaults && typeof profileDefaults === 'object' ? profileDefaults : {}
  const defaultSettings = defaults.settings && typeof defaults.settings === 'object' ? defaults.settings : {}
  return {
    ...defaults, id: null, name: `${first.name} KDS`, role: defaults.role || 'prep', display_mode: defaults.display_mode || 'ticket',
    density: defaults.density || 'comfortable', completion_scope: defaults.completion_scope || 'station',
    show_all_day: defaults.show_all_day !== false, show_station_rail: defaults.show_station_rail !== false,
    rush_after_seconds: Number(defaults.rush_after_seconds || 900), undo_window_seconds: Number(defaults.undo_window_seconds || 10),
    recently_completed_seconds: Number(defaults.recently_completed_seconds || 3600), ticket_columns: Number(defaults.ticket_columns || 4),
    text_scale: Number(defaults.text_scale || 1),
    settings: {
      ...defaultSettings,
      ticket_age_colors: normalizeTicketAgeColors(defaultSettings.ticket_age_colors || DEFAULT_TICKET_AGE_COLORS),
      metadata_visibility: {
        ...Object.fromEntries(KDS_METADATA_FIELDS.map(([key]) => [key, true])),
        ...((defaultSettings.metadata_visibility && typeof defaultSettings.metadata_visibility === 'object') ? defaultSettings.metadata_visibility : {}),
      },
      sound_enabled: defaultSettings.sound_enabled !== false, sound_on_new: defaultSettings.sound_on_new !== false,
      sound_on_rush: defaultSettings.sound_on_rush === true, allow_cancel_from_kds: defaultSettings.allow_cancel_from_kds === true,
      expo_ready_first: defaultSettings.expo_ready_first === true,
    },
    is_active: true, expected_version: 0,
    stations: [{ station_id: first.id, purpose: 'view', is_default: true, display_order: 0 }],
  }
}

export const normalizeKdsProfile = (profile, profileDefaults = null) => ({
  ...profile,
  expected_version: Number(profile.version || profile.expected_version || 0), ticket_columns: Number(profile.ticket_columns || 4),
  text_scale: Number(profile.text_scale || 1), rush_after_seconds: Number(profile.rush_after_seconds || 0),
  undo_window_seconds: Number(profile.undo_window_seconds || 10), recently_completed_seconds: Number(profile.recently_completed_seconds || 3600),
  settings: {
    ...((profileDefaults?.settings && typeof profileDefaults.settings === 'object') ? profileDefaults.settings : {}),
    ...((profile.settings && typeof profile.settings === 'object') ? profile.settings : {}),
    ticket_age_colors: normalizeTicketAgeColors(profile.settings?.ticket_age_colors || profileDefaults?.settings?.ticket_age_colors),
  },
  stations: (profile.stations || []).map((row, index) => ({ station_id: row.station_id, purpose: row.purpose || 'view', is_default: Boolean(row.is_default), display_order: Number(row.display_order ?? index) })),
})

export function kdsProfilePayload(draft, reason) {
  return {
    name: draft.name.trim(), role: draft.role, display_mode: draft.display_mode, density: draft.density, completion_scope: draft.completion_scope,
    show_all_day: draft.show_all_day, show_station_rail: draft.show_station_rail, rush_after_seconds: Number(draft.rush_after_seconds),
    undo_window_seconds: Number(draft.undo_window_seconds), recently_completed_seconds: Number(draft.recently_completed_seconds),
    ticket_columns: Number(draft.ticket_columns), text_scale: Number(draft.text_scale), settings: draft.settings || {},
    is_active: draft.is_active !== false, expected_version: Number(draft.expected_version || 0),
    stations: draft.stations.map((row, index) => ({ ...row, display_order: index })), reason: reason.trim(),
  }
}
