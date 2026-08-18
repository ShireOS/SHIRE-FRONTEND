import { useEffect, useRef, useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'
import { fetchPosApi } from '../../../shared/api/posClient'
import {
  ROUTE_INHERIT_VALUE,
  ROUTE_MULTI_VALUE,
  ROUTE_NO_PRODUCTION_VALUE,
  explicitProductionRouteValue,
  productionRouteSelectionPayload,
} from '../../../dashboard/menuRouting.js'

interface RoutingStepProps {
  onboarding: UseOnboardingReturn
}

type RoutingConfig = {
  fallback: { ok: boolean; reason?: string | null; station?: { id: string; name: string } | null }
  stations: Array<{ id: string; name: string; is_fallback?: boolean; target_count?: number }>
  targets: Array<{ id: string; name: string; connection_type: string; target_type?: string }>
  station_targets: Array<{ station_id: string; target_id: string; target_name?: string; target_type?: string; is_active?: boolean; priority?: number }>
  routing_rules: Array<{ source_type: string; source_id?: string | null; category?: string | null; station_id?: string | null; is_active?: boolean; archived_at?: string | null }>
  routing_exclusions: Array<{ source_type: string; source_id?: string | null; category?: string | null; is_active?: boolean; archived_at?: string | null }>
  menu_items: Array<{
    id: string
    name: string
    category?: string
    routing_publishable?: boolean
    routing_source?: string | null
  }>
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
  production_route_value?: string
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
  const [itemRouteValues, setItemRouteValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [workingAction, setWorkingAction] = useState<string | null>(null)
  const [savingReview, setSavingReview] = useState(false)
  const loadedRoutesRef = useRef<Map<string, string | null>>(new Map())
  const loadedItemRoutesRef = useRef<Map<string, string>>(new Map())

  const load = async () => {
    if (!restaurantId) return
    setLoading(true)
    setError(null)
    try {
      const [routingData, categoryData] = await Promise.all([
        routingFetch(restaurantId),
        menuCategoriesFetch(restaurantId),
      ])
      const loadedConfig: RoutingConfig = {
        ...routingData,
        stations: Array.isArray(routingData?.stations) ? routingData.stations : [],
        targets: Array.isArray(routingData?.targets) ? routingData.targets : [],
        station_targets: Array.isArray(routingData?.station_targets) ? routingData.station_targets : [],
        routing_rules: Array.isArray(routingData?.routing_rules) ? routingData.routing_rules : [],
        routing_exclusions: Array.isArray(routingData?.routing_exclusions) ? routingData.routing_exclusions : [],
        menu_items: Array.isArray(routingData?.menu_items) ? routingData.menu_items : [],
      }
      setConfig(loadedConfig)
      const loadedCategories: MenuCategoryRoute[] = Array.isArray(categoryData?.categories) ? categoryData.categories : []
      const categoriesWithRoutes = loadedCategories.map(category => ({
        ...category,
        production_route_value: explicitProductionRouteValue({
          sourceType: 'category',
          category: category.name,
          rules: loadedConfig.routing_rules,
          exclusions: loadedConfig.routing_exclusions,
          projectedStationId: category.routing_station_id,
        }),
      }))
      setCategories(categoriesWithRoutes)
      loadedRoutesRef.current = new Map(
        categoriesWithRoutes.map(category => [category.name, category.production_route_value || ROUTE_INHERIT_VALUE]),
      )
      const loadedItemRouteValues = Object.fromEntries(loadedConfig.menu_items.map(item => [
        item.id,
        explicitProductionRouteValue({
          sourceType: 'menu_item',
          sourceId: item.id,
          rules: loadedConfig.routing_rules,
          exclusions: loadedConfig.routing_exclusions,
        }),
      ]))
      setItemRouteValues(loadedItemRouteValues)
      loadedItemRoutesRef.current = new Map(Object.entries(loadedItemRouteValues))
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

  const pendingCategoryRoutes = () => categories.filter(category =>
    (category.production_route_value || ROUTE_INHERIT_VALUE) !== (loadedRoutesRef.current.get(category.name) ?? ROUTE_INHERIT_VALUE),
  )

  const persistCategoryRoutes = async () => {
    if (!restaurantId) return 0
    const changed = pendingCategoryRoutes()
    for (const category of changed) {
      await routingFetch(restaurantId, '/categories', {
        method: 'PUT',
        body: JSON.stringify({
          category: category.name,
          ...productionRouteSelectionPayload(category.production_route_value || ROUTE_INHERIT_VALUE),
        }),
      })
    }
    return changed.length
  }

  const saveCategoryRoutes = async () => {
    if (!restaurantId) return
    setError(null)
    setActionMessage(null)
    setWorkingAction('categoryRoutes')
    try {
      // Only send categories whose production rule changed; each save writes an
      // authoritative kitchen_routing_rules row on the POS backend (the old
      // menu-categories PUT only set a projection column that ticket routing
      // ignored).
      const changedCount = await persistCategoryRoutes()
      setActionMessage(changedCount ? 'Saved category printing rules.' : 'Category printing rules are already up to date.')
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not save category routes.'))
    } finally {
      setWorkingAction(null)
    }
  }

  const pendingItemRoutes = () => (config?.menu_items || []).filter(item =>
    (itemRouteValues[item.id] || ROUTE_INHERIT_VALUE) !== (loadedItemRoutesRef.current.get(item.id) || ROUTE_INHERIT_VALUE),
  )

  const persistItemRoutes = async () => {
    if (!restaurantId) return 0
    const changed = pendingItemRoutes()
    for (const item of changed) {
      await routingFetch(restaurantId, `/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(productionRouteSelectionPayload(itemRouteValues[item.id] || ROUTE_INHERIT_VALUE)),
      })
    }
    return changed.length
  }

  const saveItemRoutes = async () => {
    if (!restaurantId || !config) return
    setError(null)
    setActionMessage(null)
    setWorkingAction('itemRoutes')
    try {
      const changedCount = await persistItemRoutes()
      setActionMessage(changedCount ? 'Saved item printing rules.' : 'Item printing rules are already up to date.')
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not save item printing rules.'))
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
  const categoryRouteDirty = categories.some(category =>
    (category.production_route_value || ROUTE_INHERIT_VALUE) !== (loadedRoutesRef.current.get(category.name) ?? ROUTE_INHERIT_VALUE),
  )
  const itemRouteDirty = (config?.menu_items || []).some(item =>
    (itemRouteValues[item.id] || ROUTE_INHERIT_VALUE) !== (loadedItemRoutesRef.current.get(item.id) || ROUTE_INHERIT_VALUE),
  )
  const unroutedCategories = Array.from(new Set((config?.menu_items || [])
    .filter(item => !item.routing_publishable)
    .map(item => item.category || 'Other')))
  const activeStationTargets = (config?.station_targets || []).filter(link => link.is_active !== false)
  const outputByStationId = new Map(activeStationTargets.map(link => [link.station_id, link.target_id]))
  const primaryButtonClass = 'mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50'
  const inheritedRouteLabel = (item: RoutingConfig['menu_items'][number]) => {
    const category = categories.find(row => row.name.trim().toLowerCase() === (item.category || 'Other').trim().toLowerCase())
    const routeValue = category?.production_route_value || ROUTE_INHERIT_VALUE
    if (routeValue === ROUTE_NO_PRODUCTION_VALUE) return 'Category rule: no kitchen ticket'
    if (routeValue && routeValue !== ROUTE_MULTI_VALUE) {
      const station = stationOptions.find(row => row.id === routeValue)
      return `Category rule: ${station?.name || 'prep station'}`
    }
    if (routeValue === ROUTE_MULTI_VALUE) return 'Category rule: multiple prep stations'
    return config?.fallback?.station?.name ? `Restaurant fallback: ${config.fallback.station.name}` : 'No automatic route'
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {actionMessage && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{actionMessage}</div>}
      {loading && <p className="text-sm text-[rgb(var(--text-tertiary))]">Loading routing...</p>}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="label-mono text-[rgb(var(--gold))]">Production flow</p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><span className="font-semibold text-[rgb(var(--text-primary))]">1. Menu rules</span><p className="mt-1 text-[rgb(var(--text-secondary))]">Categories and item exceptions choose a prep station or No kitchen ticket.</p></div>
          <div><span className="font-semibold text-[rgb(var(--text-primary))]">2. Prep stations</span><p className="mt-1 text-[rgb(var(--text-secondary))]">Kitchen, Bar, Expo, and other stations receive the routed items.</p></div>
          <div><span className="font-semibold text-[rgb(var(--text-primary))]">3. Outputs</span><p className="mt-1 text-[rgb(var(--text-secondary))]">Each station sends its tickets to the printer or KDS display attached to it.</p></div>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${config?.fallback?.ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
          <div>
            <p className="label-mono text-[rgb(var(--gold))]">Default Prep Station</p>
            <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
              {config?.fallback?.ok
                ? `Ready. Any item without a category route goes to ${config.fallback.station?.name || 'the fallback station'}.`
                : config?.fallback?.reason || 'Choose a fallback station and assign that station an output.'}
            </p>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Used when no category or item rule exists</span>
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
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Category Printing Rules</p>
            <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">
              Choose the prep station for each category. Use No kitchen ticket for categories such as gift cards or retail merchandise.
            </p>
          </div>
          <button
            type="button"
            disabled={workingAction !== null || !categories.length || !categoryRouteDirty}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
            onClick={() => void saveCategoryRoutes()}
          >
            {workingAction === 'categoryRoutes' ? 'Saving...' : 'Save category rules'}
          </button>
        </div>
        {!stationOptions.length && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            Add a station to route printed categories. No kitchen ticket remains available without one.
          </p>
        )}
        {unroutedCategories.length > 0 && stationOptions.length > 0 && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            Needs a printing decision: {unroutedCategories.join(', ')}.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {categories.length ? categories.map(category => (
            <div key={category.id || category.name} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_220px] sm:items-center">
              <div>
                <p className="text-sm font-medium text-[rgb(var(--text-primary))]">{category.name}</p>
                <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">
                  {category.production_route_value === ROUTE_NO_PRODUCTION_VALUE
                    ? 'No kitchen or bar ticket'
                    : category.production_route_value
                      ? `Prep station: ${stationOptions.find(station => station.id === category.production_route_value)?.name || category.routing_station_name || 'selected station'}`
                      : 'Uses the default prep station'}
                </p>
              </div>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                value={category.production_route_value || ROUTE_INHERIT_VALUE}
                onChange={event => {
                  const routeValue = event.target.value
                  if (routeValue === ROUTE_MULTI_VALUE) return
                  const stationNameForId = stationOptions.find(station => station.id === routeValue)?.name || ''
                  setCategories(current => current.map(row => (
                    (row.id || row.name) === (category.id || category.name)
                      ? {
                          ...row,
                          production_route_value: routeValue,
                          routing_station_id: routeValue && routeValue !== ROUTE_NO_PRODUCTION_VALUE ? routeValue : null,
                          routing_station_name: stationNameForId,
                        }
                      : row
                  )))
                }}
                disabled={workingAction !== null}
              >
                <option value={ROUTE_INHERIT_VALUE}>Use default prep station</option>
                <option value={ROUTE_NO_PRODUCTION_VALUE}>No kitchen ticket</option>
                {category.production_route_value === ROUTE_MULTI_VALUE && <option value={ROUTE_MULTI_VALUE}>Multiple prep stations (edit later)</option>}
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
            Unsaved category printing changes. Item-specific rules below take priority over their category.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Item Printing Rules</p>
            <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">
              Items follow their category unless you choose No kitchen ticket or a different prep station here.
            </p>
          </div>
          <button
            type="button"
            disabled={workingAction !== null || !itemRouteDirty}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
            onClick={() => void saveItemRoutes()}
          >
            {workingAction === 'itemRoutes' ? 'Saving...' : 'Save item rules'}
          </button>
        </div>
        <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {config?.menu_items.length ? config.menu_items.map(item => {
            const routeValue = itemRouteValues[item.id] || ROUTE_INHERIT_VALUE
            const selectedStation = routeValue && routeValue !== ROUTE_NO_PRODUCTION_VALUE && routeValue !== ROUTE_MULTI_VALUE
              ? stationOptions.find(station => station.id === routeValue)
              : null
            return (
              <div key={item.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_260px] sm:items-center">
                <div>
                  <p className="text-sm font-medium text-[rgb(var(--text-primary))]">{item.name}</p>
                  <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">
                    {routeValue === ROUTE_NO_PRODUCTION_VALUE
                      ? 'No kitchen or bar ticket'
                      : selectedStation
                        ? `Item exception: ${selectedStation.name}`
                        : routeValue === ROUTE_MULTI_VALUE
                          ? 'Item exception: multiple prep stations'
                          : inheritedRouteLabel(item)}
                  </p>
                </div>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                  value={routeValue}
                  onChange={event => {
                    if (event.target.value === ROUTE_MULTI_VALUE) return
                    setItemRouteValues(current => ({ ...current, [item.id]: event.target.value }))
                  }}
                  disabled={workingAction !== null}
                >
                  <option value={ROUTE_INHERIT_VALUE}>Automatic · use category/default</option>
                  <option value={ROUTE_NO_PRODUCTION_VALUE}>No kitchen ticket</option>
                  {routeValue === ROUTE_MULTI_VALUE && <option value={ROUTE_MULTI_VALUE}>Multiple prep stations (edit later)</option>}
                  {stationOptions.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                </select>
              </div>
            )
          }) : (
            <p className="text-sm text-[rgb(var(--text-tertiary))]">No menu items found yet.</p>
          )}
        </div>
        {itemRouteDirty && (
          <p className="mt-3 text-xs text-[rgb(var(--text-tertiary))]">Unsaved item printing changes.</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Menu Routing Review</p>
        <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
          {blockedItems === 0
            ? 'All menu items have routing coverage.'
            : `${blockedItems} menu item${blockedItems === 1 ? ' needs' : 's need'} a prep station or No kitchen ticket rule.`}
        </p>
        {blockedItemNames.length > 0 && (
          <p className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">
            Needs review: {blockedItemNames.join(', ')}{blockedItems > blockedItemNames.length ? `, +${blockedItems - blockedItemNames.length} more` : ''}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={savingReview || workingAction !== null}
        onClick={() => {
          setSavingReview(true)
          setWorkingAction('continue')
          setError(null)
          void (async () => {
            try {
              await persistCategoryRoutes()
              await persistItemRoutes()
              await onboarding.saveRoutingProgress()
              onboarding.nextStep()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not save routing review.')
            } finally {
              setSavingReview(false)
              setWorkingAction(null)
            }
          })()
        }}
        className="w-full rounded-xl bg-white px-4 py-4 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
      >
        {savingReview ? 'Saving printing rules...' : 'Continue'}
      </button>
    </div>
  )
}
