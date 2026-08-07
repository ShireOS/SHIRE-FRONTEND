import { useEffect, useRef, useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'
import { fetchPosApi } from '../../../shared/api/posClient'

interface RoutingStepProps {
  onboarding: UseOnboardingReturn
}

type RoutingConfig = {
  fallback: { ok: boolean; reason?: string | null; station?: { id: string; name: string } | null }
  stations: Array<{ id: string; name: string; is_fallback?: boolean; target_count?: number }>
  targets: Array<{ id: string; name: string; connection_type: string; target_type?: string }>
  station_targets: Array<{ station_id: string; target_id: string; target_name?: string; target_type?: string; is_active?: boolean; priority?: number }>
  menu_items: Array<{ id: string; name: string; category?: string; routing_publishable?: boolean }>
}

type MenuCategoryRoute = {
  id?: string | null
  name: string
  tax_rate_id?: string | null
  routing_station_id?: string | null
  routing_station_name?: string | null
  default_fire_mode?: string | null
  kds_display_group?: string | null
  is_active?: boolean
}

// Kitchen routing is owned by the POS backend; stations, targets, fallback,
// and category routes all go through it so ticket printing sees the setup.
function routingFetch(restaurantId: string, path = '', options: RequestInit = {}) {
  return fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing${path}`, options)
}

async function menuCategoriesFetch(restaurantId: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/menu/categories`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

const toActionError = (err: unknown, fallback: string) => {
  if (!(err instanceof Error)) return fallback
  try {
    const parsed = JSON.parse(err.message)
    if (typeof parsed.detail === 'string') return parsed.detail
    if (typeof parsed.message === 'string') return parsed.message
  } catch {
    // Plain text backend errors are already useful enough.
  }
  return err.message || fallback
}

export function RoutingStep({ onboarding }: RoutingStepProps) {
  const restaurantId = onboarding.restaurantId
  const [config, setConfig] = useState<RoutingConfig | null>(null)
  const [stationName, setStationName] = useState('Expo')
  const [targetName, setTargetName] = useState('Kitchen Printer')
  const [targetHost, setTargetHost] = useState('')
  const [categories, setCategories] = useState<MenuCategoryRoute[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [workingAction, setWorkingAction] = useState<string | null>(null)
  const loadedRoutesRef = useRef<Map<string, string | null>>(new Map())

  const load = async () => {
    if (!restaurantId) return
    setLoading(true)
    setError(null)
    try {
      const [routingData, categoryData] = await Promise.all([
        routingFetch(restaurantId),
        menuCategoriesFetch(restaurantId),
      ])
      setConfig(routingData)
      const loadedCategories = Array.isArray(categoryData?.categories) ? categoryData.categories : []
      setCategories(loadedCategories)
      loadedRoutesRef.current = new Map(
        loadedCategories.map((category: MenuCategoryRoute) => [category.name, category.routing_station_id || null]),
      )
    } catch {
      setError('Could not load kitchen routing setup.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [restaurantId])

  const createStation = async () => {
    if (!restaurantId || !stationName.trim()) return
    setError(null)
    setActionMessage(null)
    setWorkingAction('station')
    try {
      await routingFetch(restaurantId, '/stations', {
        method: 'POST',
        body: JSON.stringify({ name: stationName.trim(), is_active: true }),
      })
      setActionMessage(`Added station "${stationName.trim()}".`)
      setStationName('')
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not create station.'))
    } finally {
      setWorkingAction(null)
    }
  }

  const createTarget = async () => {
    if (!restaurantId) return
    const name = targetName.trim() || 'Kitchen Printer'
    setError(null)
    setActionMessage(null)
    setWorkingAction('target')
    try {
      await routingFetch(restaurantId, '/targets', {
        method: 'POST',
        body: JSON.stringify({
          name,
          target_type: 'printer',
          connection_type: targetHost.trim() ? 'network' : 'dummy',
          config: targetHost.trim() ? { host: targetHost.trim(), port: 9100, profile: 'TM-T88V' } : {},
          is_active: true,
        }),
      })
      setActionMessage(`Added target "${name}".`)
      setTargetHost('')
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not create target.'))
    } finally {
      setWorkingAction(null)
    }
  }

  const saveCategoryRoutes = async () => {
    if (!restaurantId) return
    setError(null)
    setActionMessage(null)
    setWorkingAction('categoryRoutes')
    try {
      // Only send categories whose station changed; each save writes an
      // authoritative kitchen_routing_rules row on the POS backend (the old
      // menu-categories PUT only set a projection column that ticket routing
      // ignored).
      const changed = categories.filter(category =>
        (category.routing_station_id || null) !== (loadedRoutesRef.current.get(category.name) ?? null),
      )
      for (const category of changed) {
        await routingFetch(restaurantId, '/categories', {
          method: 'PUT',
          body: JSON.stringify(category.routing_station_id
            ? { category: category.name, mode: 'stations', station_ids: [category.routing_station_id] }
            : { category: category.name, mode: 'inherit', station_ids: [] }),
        })
      }
      setActionMessage(changed.length ? 'Saved category station routes.' : 'Category routes are already up to date.')
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not save category routes.'))
    } finally {
      setWorkingAction(null)
    }
  }

  const setStationOutput = async (stationId: string, targetId: string) => {
    if (!restaurantId || !config) return
    setError(null)
    setActionMessage(null)
    setWorkingAction(`stationOutput:${stationId}`)
    try {
      const currentLinks = (config.station_targets || []).filter(link => link.station_id === stationId && link.is_active !== false)
      if (!targetId) {
        await Promise.all(currentLinks.map(link => routingFetch(restaurantId, '/station-targets', {
          method: 'POST',
          body: JSON.stringify({ station_id: stationId, target_id: link.target_id, priority: link.priority || 0, is_active: false }),
        })))
        setActionMessage('Station output cleared.')
      } else {
        await Promise.all(currentLinks.filter(link => link.target_id !== targetId).map(link => routingFetch(restaurantId, '/station-targets', {
          method: 'POST',
          body: JSON.stringify({ station_id: stationId, target_id: link.target_id, priority: link.priority || 0, is_active: false }),
        })))
        await routingFetch(restaurantId, '/station-targets', {
          method: 'POST',
          body: JSON.stringify({ station_id: stationId, target_id: targetId, priority: 0, is_active: true }),
        })
        const stationNameForId = config.stations.find(station => station.id === stationId)?.name || 'Station'
        const targetNameForId = config.targets.find(target => target.id === targetId)?.name || 'output'
        setActionMessage(`${stationNameForId} now sends tickets to ${targetNameForId}.`)
      }
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not save station output.'))
    } finally {
      setWorkingAction(null)
    }
  }

  const setFallbackStation = async (stationId: string) => {
    if (!restaurantId) return
    setError(null)
    setActionMessage(null)
    setWorkingAction('fallback')
    try {
      if (stationId) {
        await routingFetch(restaurantId, '/fallback', {
          method: 'PUT',
          body: JSON.stringify({ station_id: stationId }),
        })
      } else {
        await routingFetch(restaurantId, '/fallback', { method: 'DELETE' })
      }
      const stationNameForId = config?.stations.find(station => station.id === stationId)?.name
      setActionMessage(stationNameForId ? `Fallback station set to ${stationNameForId}.` : 'Fallback station cleared.')
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not set fallback station.'))
    } finally {
      setWorkingAction(null)
    }
  }

  const blockedItems = (config?.menu_items || []).filter(item => !item.routing_publishable).length
  const blockedItemNames = (config?.menu_items || []).filter(item => !item.routing_publishable).slice(0, 4).map(item => item.name)
  const stationOptions = config?.stations || []
  const targetOptions = config?.targets || []
  const categoryRouteDirty = categories.some(category => Boolean(category.routing_station_id))
  const unroutedCategories = Array.from(new Set((config?.menu_items || [])
    .filter(item => !item.routing_publishable)
    .map(item => item.category || 'Other')))
  const activeStationTargets = (config?.station_targets || []).filter(link => link.is_active !== false)
  const outputByStationId = new Map(activeStationTargets.map(link => [link.station_id, link.target_id]))
  const primaryButtonClass = 'mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50'

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {actionMessage && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{actionMessage}</div>}
      {loading && <p className="text-sm text-[rgb(var(--text-tertiary))]">Loading routing...</p>}

      <div className={`rounded-2xl border p-4 ${config?.fallback?.ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
          <div>
            <p className="label-mono text-[rgb(var(--gold))]">Fallback Station</p>
            <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
              {config?.fallback?.ok
                ? `Ready. Any item without a category route goes to ${config.fallback.station?.name || 'the fallback station'}.`
                : config?.fallback?.reason || 'Choose a fallback station and assign that station an output.'}
            </p>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Default for unrouted items</span>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
              value={config?.fallback?.station?.id || ''}
              onChange={event => void setFallbackStation(event.target.value)}
              disabled={!stationOptions.length || workingAction !== null}
            >
              <option value="">No fallback selected</option>
              {stationOptions.map(station => (
                <option key={station.id} value={station.id}>{station.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Prep Stations</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Stations are where items are prepared, like Kitchen, Bar, Expo, or Dessert.</p>
          <input className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" value={stationName} onChange={event => setStationName(event.target.value)} />
          <button disabled={workingAction !== null || !stationName.trim()} className={primaryButtonClass} onClick={() => void createStation()}>
            {workingAction === 'station' ? 'Adding...' : 'Add station'}
          </button>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(var(--text-tertiary))]">Existing stations</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {config?.stations.length ? config.stations.map(station => (
                <span key={station.id} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[rgb(var(--text-secondary))]">
                  {station.name}{station.is_fallback ? ' · fallback' : ''}
                </span>
              )) : <span className="text-xs text-[rgb(var(--text-tertiary))]">None yet</span>}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Printers & Displays</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Outputs are the printers or screens that receive tickets from a station.</p>
          <input className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" value={targetName} onChange={event => setTargetName(event.target.value)} />
          <input className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" placeholder="Printer host/IP, or blank for dummy" value={targetHost} onChange={event => setTargetHost(event.target.value)} />
          <button disabled={workingAction !== null} className={primaryButtonClass} onClick={() => void createTarget()}>
            {workingAction === 'target' ? 'Adding...' : 'Add target'}
          </button>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(var(--text-tertiary))]">Existing targets</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {config?.targets.length ? config.targets.map(target => (
                <span key={target.id} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[rgb(var(--text-secondary))]">
                  {target.name} · {target.connection_type}
                </span>
              )) : <span className="text-xs text-[rgb(var(--text-tertiary))]">None yet</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Station Outputs</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">
            Assign the printer or display each station should send tickets to.
          </p>
        </div>
        {(!stationOptions.length || !targetOptions.length) && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            Add at least one station and one printer/display before assigning outputs.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {stationOptions.length ? stationOptions.map(station => {
            const outputId = outputByStationId.get(station.id) || ''
            const working = workingAction === `stationOutput:${station.id}`
            return (
              <div key={station.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_260px] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-[rgb(var(--text-primary))]">
                    {station.name}{station.is_fallback ? <span className="ml-2 text-xs text-emerald-200">fallback</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">
                    {outputId ? `Output: ${targetOptions.find(target => target.id === outputId)?.name || 'selected output'}` : 'No output assigned yet'}
                  </p>
                </div>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                  value={outputId}
                  onChange={event => void setStationOutput(station.id, event.target.value)}
                  disabled={!targetOptions.length || workingAction !== null}
                >
                  <option value="">{working ? 'Saving...' : 'No output assigned'}</option>
                  {targetOptions.map(target => (
                    <option key={target.id} value={target.id}>{target.name}</option>
                  ))}
                </select>
              </div>
            )
          }) : (
            <p className="text-sm text-[rgb(var(--text-tertiary))]">No stations found yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Category Station Routes</p>
            <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">
              Choose the station that prepares each category. Leave a category on fallback when it should use the default station above.
            </p>
          </div>
          <button
            type="button"
            disabled={workingAction !== null || !stationOptions.length || !categories.length}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
            onClick={() => void saveCategoryRoutes()}
          >
            {workingAction === 'categoryRoutes' ? 'Saving...' : 'Save routes'}
          </button>
        </div>
        {!stationOptions.length && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            Add a station before assigning category routes.
          </p>
        )}
        {unroutedCategories.length > 0 && stationOptions.length > 0 && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            Needs a station: {unroutedCategories.join(', ')}.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {categories.length ? categories.map(category => (
            <div key={category.id || category.name} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_220px] sm:items-center">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--text-primary))]">{category.name}</p>
                {category.routing_station_name && (
                  <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">Current station: {category.routing_station_name}</p>
                )}
              </div>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                value={category.routing_station_id || ''}
                onChange={event => {
                  const stationId = event.target.value
                  const stationNameForId = stationOptions.find(station => station.id === stationId)?.name || ''
                  setCategories(current => current.map(row => (
                    (row.id || row.name) === (category.id || category.name)
                      ? { ...row, routing_station_id: stationId, routing_station_name: stationNameForId }
                      : row
                  )))
                }}
                disabled={!stationOptions.length || workingAction !== null}
              >
                <option value="">Use fallback only</option>
                {stationOptions.map(station => (
                  <option key={station.id} value={station.id}>{station.name}</option>
                ))}
              </select>
            </div>
          )) : (
            <p className="text-sm text-[rgb(var(--text-tertiary))]">No menu categories found yet.</p>
          )}
        </div>
        {categoryRouteDirty && (
          <p className="mt-3 text-xs text-[rgb(var(--text-tertiary))]">
            Category routes cover every item in that category unless an item gets its own advanced override later.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Menu Routing Review</p>
        <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
          {blockedItems === 0
            ? 'All menu items have routing coverage.'
            : `${blockedItems} menu item${blockedItems === 1 ? ' does' : 's do'} not have a category station route yet. They will use the fallback route until you assign the category above.`}
        </p>
        {blockedItemNames.length > 0 && (
          <p className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">
            Needs review: {blockedItemNames.join(', ')}{blockedItems > blockedItemNames.length ? `, +${blockedItems - blockedItemNames.length} more` : ''}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onboarding.nextStep}
        className="w-full rounded-xl bg-white px-4 py-4 text-sm font-semibold text-black transition-colors hover:bg-gray-100"
      >
        Continue
      </button>
    </div>
  )
}
