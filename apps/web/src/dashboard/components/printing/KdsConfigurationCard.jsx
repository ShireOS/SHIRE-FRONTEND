import { useEffect, useRef, useState } from 'react'
import { Check, ChefHat, Clock3, Loader2, MonitorSmartphone, Plus, RefreshCw, Save, Settings2, Volume2 } from 'lucide-react'
import { assignKdsDevice, createKdsProfile, fetchKdsConfiguration, updateKdsProfile } from '../../../shared/api/kds'

const METADATA_FIELDS = [
  ['table_number', 'Table / tab'],
  ['guest_name', 'Guest name'],
  ['waiter_name', 'Server'],
  ['order_channel', 'Order method'],
  ['course', 'Course'],
  ['seat', 'Seat'],
  ['descriptions', 'Item descriptions in details'],
]

const emptyConfiguration = () => ({ profiles: [], stations: [], devices: [], display_groups: [], metrics: {} })

const blankProfile = stations => {
  const first = stations.find(station => station.station_type !== 'expo')
  if (!first) return null
  return {
    id: null,
    name: first ? `${first.name} KDS` : 'Kitchen KDS',
    role: 'prep',
    display_mode: 'ticket',
    density: 'comfortable',
    completion_scope: 'station',
    show_all_day: true,
    show_station_rail: true,
    rush_after_seconds: 900,
    undo_window_seconds: 10,
    recently_completed_seconds: 3600,
    ticket_columns: 4,
    text_scale: 1,
    settings: {
      metadata_visibility: Object.fromEntries(METADATA_FIELDS.map(([key]) => [key, true])),
      sound_enabled: true,
      sound_on_new: true,
      sound_on_rush: false,
      allow_cancel_from_kds: false,
      expo_ready_first: false,
    },
    is_active: true,
    expected_version: 0,
    stations: first ? [{ station_id: first.id, purpose: 'view', is_default: true, display_order: 0 }] : [],
  }
}

const normalizeProfile = profile => ({
  ...profile,
  expected_version: Number(profile.version || profile.expected_version || 0),
  ticket_columns: Number(profile.ticket_columns || 4),
  text_scale: Number(profile.text_scale || 1),
  rush_after_seconds: Number(profile.rush_after_seconds || 0),
  undo_window_seconds: Number(profile.undo_window_seconds || 10),
  recently_completed_seconds: Number(profile.recently_completed_seconds || 3600),
  settings: profile.settings && typeof profile.settings === 'object' ? profile.settings : {},
  stations: (profile.stations || []).map((row, index) => ({
    station_id: row.station_id,
    purpose: row.purpose || 'view',
    is_default: Boolean(row.is_default),
    display_order: Number(row.display_order ?? index),
  })),
})

function Toggle({ label, detail, checked, onChange }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-white/10 py-3 last:border-0">
    <span><span className="block text-sm font-medium text-dash-cream">{label}</span>{detail && <span className="mt-0.5 block text-xs text-dash-tertiary">{detail}</span>}</span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-dash-gold" />
  </label>
}

function Field({ label, children }) {
  return <label className="block"><span className="label-mono">{label}</span>{children}</label>
}

const inputClass = 'mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-dash-cream outline-none focus:border-dash-gold/60'

export default function KdsConfigurationCard({ restaurantId }) {
  const [configuration, setConfiguration] = useState(emptyConfiguration)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')
  const restaurantRef = useRef(String(restaurantId))
  const loadRequestRef = useRef(0)
  const loadSequenceRef = useRef(0)
  const appliedLoadRef = useRef(0)
  const mutationInFlightRef = useRef(false)

  const load = async (signal, { replaceDraft = false, background = false } = {}) => {
    if (background && mutationInFlightRef.current) return
    const requestedRestaurant = String(restaurantId)
    const generation = loadRequestRef.current
    const requestId = ++loadSequenceRef.current
    if (!background) { setLoading(true); setError('') }
    try {
      const data = await fetchKdsConfiguration(restaurantId, signal)
      if (signal.aborted || restaurantRef.current !== requestedRestaurant || generation !== loadRequestRef.current || requestId < appliedLoadRef.current) return
      appliedLoadRef.current = requestId
      setConfiguration(data)
      if (replaceDraft) setDraft(data.profiles.length ? normalizeProfile(data.profiles[0]) : blankProfile(data.stations))
    } catch (err) {
      if (!background && err?.name !== 'AbortError' && restaurantRef.current === requestedRestaurant) {
        setError(err?.message || 'Could not load KDS configuration')
      }
    } finally {
      if (!background && !signal.aborted && restaurantRef.current === requestedRestaurant && generation === loadRequestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    restaurantRef.current = String(restaurantId)
    loadRequestRef.current += 1
    setConfiguration(emptyConfiguration())
    setDraft(null)
    setReason('')
    setError('')
    setMessage('')
    setSaving(false)
    mutationInFlightRef.current = false
    setLoading(true)
    void load(controller.signal, { replaceDraft: true })
    const refreshTimer = setInterval(() => void load(controller.signal, { background: true }), 15_000)
    return () => { controller.abort(); clearInterval(refreshTimer); loadRequestRef.current += 1 }
  }, [restaurantId])

  const prepStations = configuration.stations.filter(station => station.station_type !== 'expo')
  const expoStations = configuration.stations.filter(station => station.station_type === 'expo')
  const canCreateProfile = prepStations.length > 0
  const viewLinks = draft?.stations.filter(row => row.purpose === 'view') || []
  const superviseLinks = draft?.stations.filter(row => row.purpose === 'supervise') || []

  const patch = values => setDraft(current => ({ ...current, ...values }))
  const patchSettings = values => setDraft(current => ({ ...current, settings: { ...(current.settings || {}), ...values } }))
  const toggleViewStation = stationId => setDraft(current => {
    const links = [...current.stations]
    const index = links.findIndex(row => row.station_id === stationId && row.purpose === 'view')
    if (index >= 0) {
      if (links.filter(row => row.purpose === 'view').length === 1) return current
      const wasDefault = links[index].is_default
      links.splice(index, 1)
      if (wasDefault) {
        const first = links.find(row => row.purpose === 'view')
        if (first) first.is_default = true
      }
    } else {
      links.push({ station_id: stationId, purpose: 'view', is_default: !links.some(row => row.purpose === 'view'), display_order: links.length })
    }
    return { ...current, stations: links }
  })
  const toggleSupervisedStation = stationId => setDraft(current => {
    const exists = current.stations.some(row => row.station_id === stationId && row.purpose === 'supervise')
    return {
      ...current,
      stations: exists
        ? current.stations.filter(row => !(row.station_id === stationId && row.purpose === 'supervise'))
        : [...current.stations, { station_id: stationId, purpose: 'supervise', is_default: false, display_order: current.stations.length }],
    }
  })
  const makeDefault = stationId => setDraft(current => ({
    ...current,
    stations: current.stations.map(row => row.purpose === 'view' ? { ...row, is_default: row.station_id === stationId } : row),
  }))

  const changeRole = role => setDraft(current => {
    if (role === 'expo') {
      const expo = expoStations[0]
      return {
        ...current,
        role,
        completion_scope: 'station',
        stations: [
          ...(expo ? [{ station_id: expo.id, purpose: 'view', is_default: true, display_order: 0 }] : []),
          ...prepStations.map((station, index) => ({ station_id: station.id, purpose: 'supervise', is_default: false, display_order: index + 1 })),
        ],
      }
    }
    const first = prepStations[0]
    return { ...current, role, stations: first ? [{ station_id: first.id, purpose: 'view', is_default: true, display_order: 0 }] : [] }
  })

  const save = async () => {
    if (!draft?.name.trim()) return setError('Name this KDS profile.')
    if (!viewLinks.length) return setError('Choose at least one station this KDS displays.')
    if (draft.role === 'expo' && !superviseLinks.length) return setError('Choose at least one prep station for expo to supervise.')
    if (!reason.trim()) return setError('Enter a reason for this KDS configuration change.')
    const requestedRestaurant = String(restaurantId)
    const generation = ++loadRequestRef.current
    mutationInFlightRef.current = true
    setSaving(true); setError(''); setMessage('')
    try {
      const payload = {
        name: draft.name.trim(), role: draft.role, display_mode: draft.display_mode,
        density: draft.density, completion_scope: draft.completion_scope,
        show_all_day: draft.show_all_day, show_station_rail: draft.show_station_rail,
        rush_after_seconds: Number(draft.rush_after_seconds),
        undo_window_seconds: Number(draft.undo_window_seconds),
        recently_completed_seconds: Number(draft.recently_completed_seconds),
        ticket_columns: Number(draft.ticket_columns), text_scale: Number(draft.text_scale),
        settings: draft.settings || {}, is_active: draft.is_active !== false,
        expected_version: Number(draft.expected_version || 0),
        stations: draft.stations.map((row, index) => ({ ...row, display_order: index })),
        reason: reason.trim(),
      }
      const data = draft.id
        ? await updateKdsProfile(restaurantId, draft.id, payload)
        : await createKdsProfile(restaurantId, payload)
      if (restaurantRef.current !== requestedRestaurant || generation !== loadRequestRef.current) return
      setConfiguration(data)
      const saved = draft.id
        ? data.profiles.find(profile => profile.id === draft.id)
        : [...data.profiles].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      setDraft(saved ? normalizeProfile(saved) : blankProfile(data.stations))
      setReason('')
      setMessage('KDS profile saved. Assigned iPads will receive it on their next sync.')
    } catch (err) {
      if (restaurantRef.current === requestedRestaurant && generation === loadRequestRef.current) setError(err?.message || 'Could not save KDS profile')
    } finally {
      mutationInFlightRef.current = false
      if (restaurantRef.current === requestedRestaurant && generation === loadRequestRef.current) setSaving(false)
    }
  }

  const assign = async (deviceId, profileId) => {
    if (!reason.trim()) return setError('Enter a reason before assigning a KDS iPad.')
    const requestedRestaurant = String(restaurantId)
    const generation = ++loadRequestRef.current
    mutationInFlightRef.current = true
    setSaving(true); setError(''); setMessage('')
    try {
      const data = await assignKdsDevice(restaurantId, deviceId, profileId, reason.trim())
      if (restaurantRef.current !== requestedRestaurant || generation !== loadRequestRef.current) return
      setConfiguration(data)
      setReason('')
      setMessage('KDS iPad assigned. Its display target now follows the selected profile stations.')
    } catch (err) {
      if (restaurantRef.current === requestedRestaurant && generation === loadRequestRef.current) setError(err?.message || 'Could not assign KDS iPad')
    } finally {
      mutationInFlightRef.current = false
      if (restaurantRef.current === requestedRestaurant && generation === loadRequestRef.current) setSaving(false)
    }
  }

  if (loading && !draft) return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"><Loader2 className="h-5 w-5 animate-spin text-dash-gold" /></section>

  return <div className="space-y-5">
    <div>
      <p className="label-mono">Printing & Routing</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold tracking-tight">Kitchen displays</h1><p className="mt-2 max-w-3xl text-sm text-dash-secondary">A KDS receives the same station-routed item subset as that station's printer. Display groups organize the left all-day rail; they never reroute food.</p></div>
        <button type="button" disabled={!canCreateProfile} title={!canCreateProfile ? 'Create an active prep station in Kitchen Routing first' : undefined} onClick={() => setDraft(blankProfile(configuration.stations))} className="inline-flex items-center gap-2 rounded-xl border border-dash-gold/40 px-4 py-2.5 text-sm font-semibold text-dash-gold disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> New profile</button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
    {message && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div>}
    {!loading && !canCreateProfile && <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">Create at least one active non-Expo production station in Kitchen Routing before creating a KDS profile. Expo profiles also need a prep station to supervise.</div>}

    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <Field label="Manager reason"><input maxLength={300} value={reason} onChange={event => setReason(event.target.value)} placeholder="Why is this KDS configuration changing?" className={inputClass} /></Field>
      <p className="mt-2 text-xs text-dash-tertiary">Required for profile saves and iPad assignments; stored with the existing KDS audit event.</p>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Active tickets', configuration.metrics?.active_tickets ?? 0],
        ['Completed · 24h', configuration.metrics?.completed_last_24h ?? 0],
        ['Median completion', configuration.metrics?.median_completion_seconds == null ? '—' : `${Math.round(Number(configuration.metrics.median_completion_seconds) / 60)} min`],
        ['KDS online', `${configuration.metrics?.online_devices ?? 0} / ${configuration.metrics?.paired_devices ?? configuration.devices.length}`],
      ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="label-mono">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
    </div>

    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center gap-3"><ChefHat className="h-5 w-5 text-dash-gold" /><div><h2 className="font-semibold">Display profiles</h2><p className="text-xs text-dash-tertiary">Reusable behavior assigned to one or more paired KDS iPads.</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {configuration.profiles.map(profile => <button key={profile.id} type="button" onClick={() => setDraft(normalizeProfile(profile))} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${draft?.id === profile.id ? 'border-dash-gold/60 bg-dash-gold/10 text-dash-gold' : 'border-white/10 text-dash-secondary'}`}>{profile.name}{profile.is_active === false ? ' · Inactive' : ''}</button>)}
        {!configuration.profiles.length && <span className="text-sm text-dash-tertiary">No KDS profiles yet.</span>}
      </div>
    </section>

    {draft && <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Profile name"><input maxLength={100} value={draft.name} onChange={event => patch({ name: event.target.value })} className={inputClass} /></Field>
            <Field label="Kitchen role"><select value={draft.role} onChange={event => changeRole(event.target.value)} className={inputClass}><option value="prep">Prep station</option><option value="expo" disabled={!expoStations.length}>Expo / assembly</option></select></Field>
          </div>
          <div className="mt-3"><Toggle label="Profile active" detail="Reassign every iPad before turning this off; inactive profiles cannot receive new device assignments." checked={draft.is_active !== false} onChange={value => patch({ is_active: value })} /></div>
          <div className="mt-5"><p className="label-mono">Stations shown on this KDS</p><p className="mt-1 text-xs text-dash-tertiary">Item routing already decides which prep station receives food. These choices decide which station queues this screen may view and control.</p></div>
          <div className="mt-3 space-y-2">
            {(draft.role === 'expo' ? expoStations : prepStations).map(station => {
              const link = viewLinks.find(row => row.station_id === station.id)
              return <div key={station.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-3"><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(link)} onChange={() => toggleViewStation(station.id)} className="h-4 w-4 accent-dash-gold" />{station.name}<span className="text-xs text-dash-tertiary">{station.station_type}</span></label>{link && <label className="flex items-center gap-2 text-xs text-dash-secondary"><input name="default-kds-station" type="radio" checked={link.is_default} onChange={() => makeDefault(station.id)} className="accent-dash-gold" /> Opens here</label>}</div>
            })}
            {draft.role === 'expo' && !expoStations.length && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">Create a kitchen station with station type “expo” in Routing before creating an expo profile.</p>}
          </div>
          {draft.role === 'expo' && <div className="mt-5"><p className="label-mono">Prep stations supervised by expo</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{prepStations.map(station => <label key={station.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 p-3 text-sm"><input type="checkbox" checked={superviseLinks.some(row => row.station_id === station.id)} onChange={() => toggleSupervisedStation(station.id)} className="accent-dash-gold" />{station.name}</label>)}</div></div>}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-dash-gold" /><h2 className="font-semibold">Layout & interaction</h2></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Primary display"><select value={draft.display_mode} onChange={event => patch({ display_mode: event.target.value })} className={inputClass}><option value="ticket">Tickets · receipt-style checks</option><option value="item">Items · each row retains check, table and guest</option><option value="split">Split · items plus ticket context</option><option value="all_day">All-day production totals</option></select></Field>
            <Field label="Density"><select value={draft.density} onChange={event => patch({ density: event.target.value })} className={inputClass}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></Field>
            <Field label="Ticket columns"><input type="number" min="1" max="8" value={draft.ticket_columns} onChange={event => patch({ ticket_columns: event.target.value })} className={inputClass} /></Field>
            <Field label="Text scale"><input type="number" min="0.75" max="2" step="0.05" value={draft.text_scale} onChange={event => patch({ text_scale: event.target.value })} className={inputClass} /></Field>
          </div>
          <div className="mt-3"><Toggle label="Left all-day rail" detail="Groups outstanding quantities by the menu item/category KDS display group." checked={draft.show_all_day} onChange={value => patch({ show_all_day: value })} /><Toggle label="Slim station rail on the right" detail="Shows actual prep stations, outstanding counts, and highlights the active queue." checked={draft.show_station_rail} onChange={value => patch({ show_station_rail: value })} /></div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-dash-gold" /><h2 className="font-semibold">Timing, completion & recovery</h2></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Show Rush after (minutes)"><input type="number" min="0" max="120" value={Number(draft.rush_after_seconds) / 60} onChange={event => patch({ rush_after_seconds: Math.round(Number(event.target.value) * 60) })} className={inputClass} /></Field>
            <Field label="Undo window (seconds)"><input type="number" min="3" max="30" value={draft.undo_window_seconds} onChange={event => patch({ undo_window_seconds: event.target.value })} className={inputClass} /></Field>
            <Field label="Recall history (hours)"><input type="number" min="1" max="24" value={Math.round(Number(draft.recently_completed_seconds) / 3600)} onChange={event => patch({ recently_completed_seconds: Math.round(Number(event.target.value) * 3600) })} className={inputClass} /></Field>
            {draft.role === 'prep' && <Field label="Whole-ticket bump"><select value={draft.completion_scope} onChange={event => patch({ completion_scope: event.target.value })} className={inputClass}><option value="station">Only active station</option><option value="all_prep">All prep stations shown here</option></select></Field>}
          </div>
          <p className="mt-3 text-xs text-dash-tertiary">Rush uses a compact clock-and-arrow badge; ticket color remains neutral. Undo is available only for this screen's most recent action, while Recall stays available in completed history.</p>
          <div className="mt-3"><Toggle label="Allow cancellations from KDS" detail="Off by default. When off, canceled items and checks must originate from POS and the KDS only reflects them." checked={draft.settings?.allow_cancel_from_kds === true} onChange={value => patchSettings({ allow_cancel_from_kds: value })} /></div>
          {draft.role === 'expo' && <div className="mt-1"><Toggle label="Move all-prep-ready checks forward" detail="Keeps rush checks first, then brings checks ready for expo handoff ahead of ordinary work." checked={draft.settings?.expo_ready_first === true} onChange={value => patchSettings({ expo_ready_first: value })} /></div>}
        </section>
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="font-semibold">Ticket information</h2><p className="mt-1 text-xs text-dash-tertiary">Check number is always shown, including in item mode. These toggles control secondary labels and the detail drawer.</p>
          <div className="mt-3">{METADATA_FIELDS.map(([key, label]) => <Toggle key={key} label={label} checked={draft.settings?.metadata_visibility?.[key] !== false} onChange={value => patchSettings({ metadata_visibility: { ...(draft.settings?.metadata_visibility || {}), [key]: value } })} />)}</div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center gap-3"><Volume2 className="h-5 w-5 text-dash-gold" /><h2 className="font-semibold">Sound</h2></div>
          <div className="mt-3"><Toggle label="Enable KDS sounds" checked={draft.settings?.sound_enabled !== false} onChange={value => patchSettings({ sound_enabled: value })} /><Toggle label="New-ticket tone" checked={draft.settings?.sound_on_new !== false} onChange={value => patchSettings({ sound_on_new: value })} /><Toggle label="Rush reminder tone" checked={draft.settings?.sound_on_rush === true} onChange={value => patchSettings({ sound_on_rush: value })} /></div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="font-semibold">Current display groups</h2><p className="mt-1 text-xs text-dash-tertiary">Menu-item group overrides category group; category snapshot is the fallback. These become sections in the left rail only.</p>
          <div className="mt-3 max-h-64 space-y-2 overflow-auto">{configuration.display_groups.filter(row => row.kds_display_group).map(row => <div key={`${row.source_type}:${row.source_id}`} className="flex justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-xs"><span>{row.name}</span><span className="text-dash-gold">{row.kds_display_group}</span></div>)}{!configuration.display_groups.some(row => row.kds_display_group) && <p className="text-sm text-dash-tertiary">No custom display groups. The KDS will group by the item's category snapshot.</p>}</div>
        </section>
        <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-dash-gold px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : 'Save KDS profile'}</button>
      </div>
    </div>}

    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center gap-3"><MonitorSmartphone className="h-5 w-5 text-dash-gold" /><div><h2 className="font-semibold">Paired KDS iPads</h2><p className="text-xs text-dash-tertiary">Pair from the KDS app first, then assign its profile here. Assignment creates the display target and attaches it to the profile's source stations.</p></div></div>
      <div className="mt-4 space-y-3">{configuration.devices.map(device => <div key={device.id} className="grid items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_auto]"><div><p className="text-sm font-semibold">{device.name}</p><p className="mt-1 text-xs text-dash-tertiary">{device.last_heartbeat_at ? `Last KDS sync ${new Date(device.last_heartbeat_at).toLocaleString()}` : 'Paired · waiting for first KDS sync'}</p></div><select aria-label={`Profile for ${device.name}`} value={device.profile_id || ''} onChange={event => void assign(device.id, event.target.value)} disabled={saving || !eventProfiles(configuration.profiles).length} className={inputClass.replace('mt-2 ', '')}><option value="" disabled>Choose a profile</option>{eventProfiles(configuration.profiles).map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><span className={`inline-flex items-center gap-1 text-xs ${device.is_online ? 'text-emerald-200' : 'text-dash-tertiary'}`}>{device.is_online ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}{device.is_online ? 'Connected' : device.last_heartbeat_at ? 'Offline' : 'Awaiting app'}</span></div>)}{!configuration.devices.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-dash-tertiary">No KDS iPad is paired yet. Install the Shire KDS app and pair it to this restaurant; it will then appear here.</p>}</div>
    </section>
  </div>
}

// Kept as a named helper so the assignment select has a stable, testable
// disabled rule without hiding newly-created profiles during a render.
function eventProfiles(profiles) {
  return Array.isArray(profiles) ? profiles.filter(profile => profile.is_active !== false) : []
}
