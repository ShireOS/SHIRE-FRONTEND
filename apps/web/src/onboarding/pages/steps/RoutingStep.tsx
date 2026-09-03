import { useEffect, useRef, useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'
import { fetchPosApi } from '../../../shared/api/posClient'
import { createKdsProfile, fetchKdsConfiguration, updateKdsProfile } from '../../../shared/api/kds'
import KdsTimingEditor from '../../../shared/KdsTimingEditor'
import { ticketTimingError } from '../../../shared/kdsPresentation'
import { blankKdsProfile, kdsProfilePayload, normalizeKdsProfile } from '../../../shared/kdsProfileDraft'
import { collapseEntryWhitespace, duplicateName, printerHostError } from '@shire/settings'
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
  stations: Array<{ id: string; name: string; description?: string | null; display_order?: number; is_active?: boolean; is_fallback?: boolean; target_count?: number; station_type?: string; kds_enabled?: boolean }>
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
  const [stationName, setStationName] = useState('')
  const [targetName, setTargetName] = useState('')
  const [targetHost, setTargetHost] = useState('')
  const [targetType, setTargetType] = useState<'printer' | 'display'>('printer')
  const [kdsDraft, setKdsDraft] = useState<any>(null)
  const [kdsError, setKdsError] = useState('')
  const [categories, setCategories] = useState<MenuCategoryRoute[]>([])
  const [itemRouteValues, setItemRouteValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [recentlyAddedStation, setRecentlyAddedStation] = useState<{ id: string | null; name: string } | null>(null)
  const [recentlyAddedTarget, setRecentlyAddedTarget] = useState<{ id: string | null; name: string } | null>(null)
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
      const [routingData, categoryData, kdsData] = await Promise.all([
        routingFetch(restaurantId),
        menuCategoriesFetch(restaurantId),
        fetchKdsConfiguration(restaurantId),
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
      const prepProfile = (Array.isArray(kdsData?.profiles) ? kdsData.profiles : []).find((profile: any) => profile.role === 'prep' && profile.is_active !== false)
      setKdsDraft(prepProfile
        ? normalizeKdsProfile(prepProfile, kdsData?.profile_defaults)
        : blankKdsProfile(loadedConfig.stations, kdsData?.profile_defaults))
      setKdsError('')
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

  useEffect(() => {
    if (error) window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [error])

  const createStation = async () => {
    if (!restaurantId) return
    const name = collapseEntryWhitespace(stationName)
    if (!name) {
      setError('Station name is required.')
      return
    }
    if (duplicateName(config?.stations.map(station => station.name) || [], name)) {
      setError('That station already exists.')
      return
    }
    setError(null)
    setWorkingAction('station')
    try {
      const created = await routingFetch(restaurantId, '/stations', {
        method: 'POST',
        body: JSON.stringify({ name, station_type: 'prep', kds_enabled: true, is_active: true }),
      })
      setRecentlyAddedStation({ id: typeof created?.id === 'string' ? created.id : null, name })
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
    const name = collapseEntryWhitespace(targetName)
    if (!name) {
      setError('Output name is required.')
      return
    }
    if (duplicateName(config?.targets.map(target => target.name) || [], name)) {
      setError('That output target already exists.')
      return
    }
    const hostError = targetType === 'printer' ? printerHostError(targetHost) : ''
    if (hostError) {
      setError(hostError)
      return
    }
    setError(null)
    setWorkingAction('target')
    try {
      const created = await routingFetch(restaurantId, '/targets', {
        method: 'POST',
        body: JSON.stringify({
          name,
          target_type: targetType,
          connection_type: targetType === 'display' ? 'display_queue' : targetHost.trim() ? 'network' : 'dummy',
          config: targetType === 'printer' && targetHost.trim() ? { host: targetHost.trim().toLowerCase(), port: 9100, profile: 'TM-T88V' } : {},
          is_active: true,
        }),
      })
      setRecentlyAddedTarget({ id: typeof created?.id === 'string' ? created.id : null, name })
      setTargetName('')
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
    setWorkingAction('categoryRoutes')
    try {
      // Only send categories whose production rule changed; each save writes an
      // authoritative kitchen_routing_rules row on the POS backend (the old
      // menu-categories PUT only set a projection column that ticket routing
      // ignored).
      await persistCategoryRoutes()
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
    setWorkingAction('itemRoutes')
    try {
      await persistItemRoutes()
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
    setWorkingAction(`stationOutput:${stationId}`)
    try {
      const currentLinks = (config.station_targets || []).filter(link => link.station_id === stationId && link.is_active !== false)
      if (!targetId) {
        await Promise.all(currentLinks.map(link => routingFetch(restaurantId, '/station-targets', {
          method: 'POST',
          body: JSON.stringify({ station_id: stationId, target_id: link.target_id, priority: link.priority || 0, is_active: false }),
        })))
      } else {
        await Promise.all(currentLinks.filter(link => link.target_id !== targetId).map(link => routingFetch(restaurantId, '/station-targets', {
          method: 'POST',
          body: JSON.stringify({ station_id: stationId, target_id: link.target_id, priority: link.priority || 0, is_active: false }),
        })))
        await routingFetch(restaurantId, '/station-targets', {
          method: 'POST',
          body: JSON.stringify({ station_id: stationId, target_id: targetId, priority: 0, is_active: true }),
        })
        const selectedTarget = config.targets.find(target => target.id === targetId)
        const selectedStation = config.stations.find(station => station.id === stationId)
        if (selectedTarget?.target_type === 'display' && selectedStation && selectedStation.kds_enabled !== true) {
          await routingFetch(restaurantId, `/stations/${stationId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: selectedStation.name,
              description: selectedStation.description || null,
              display_order: Number(selectedStation.display_order || 0),
              is_active: selectedStation.is_active !== false,
              station_type: selectedStation.station_type || 'prep',
              kds_enabled: true,
            }),
          })
        }
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
      await load()
    } catch (err) {
      setError(toActionError(err, 'Could not set fallback station.'))
    } finally {
      setWorkingAction(null)
    }
  }

  const persistKdsTiming = async () => {
    if (!restaurantId) return
    if (!kdsDraft) throw new Error('Create at least one prep station before saving KDS timing.')
    const validation = ticketTimingError(kdsDraft.settings?.ticket_age_colors, Number(kdsDraft.rush_after_seconds))
    if (validation) {
      setKdsError(validation)
      throw new Error(validation)
    }
    setKdsError('')
    const payload = kdsProfilePayload(kdsDraft, 'Initial KDS timing configured during onboarding')
    const result = kdsDraft.id
      ? await updateKdsProfile(restaurantId, kdsDraft.id, payload)
      : await createKdsProfile(restaurantId, payload)
    const saved = kdsDraft.id
      ? result.profiles?.find((profile: any) => profile.id === kdsDraft.id)
      : [...(result.profiles || [])].sort((left: any, right: any) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0]
    if (!saved) throw new Error('KDS timing saved, but the profile could not be reloaded.')
    setKdsDraft(normalizeKdsProfile(saved, result.profile_defaults))
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
  const connectedStationIds = new Set(activeStationTargets.map(link => link.station_id))
  const fallbackOptions = stationOptions.filter(station => connectedStationIds.has(station.id))
  const currentFallbackId = config?.fallback?.station?.id || ''
  const currentFallbackNeedsOutput = Boolean(currentFallbackId) && !connectedStationIds.has(currentFallbackId)
  const primaryButtonClass = 'mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50'
  const outputNamesForStation = (stationId: string) => activeStationTargets
    .filter(link => link.station_id === stationId)
    .map(link => link.target_name || targetOptions.find(target => target.id === link.target_id)?.name)
    .filter((name): name is string => Boolean(name))
  const stationRouteLabel = (stationId: string) => {
    const station = stationOptions.find(row => row.id === stationId)
    const outputNames = outputNamesForStation(stationId)
    return `${station?.name || 'Unknown station'} → ${outputNames.length ? outputNames.join(' + ') : 'No output connected'}`
  }
  const categoryRouteLabel = (category: MenuCategoryRoute) => {
    const routeValue = category.production_route_value || ROUTE_INHERIT_VALUE
    if (routeValue === ROUTE_NO_PRODUCTION_VALUE) return `${category.name} → No kitchen ticket`
    if (routeValue === ROUTE_MULTI_VALUE) return `${category.name} → Multiple prep stations`
    if (routeValue) return `${category.name} → ${stationRouteLabel(routeValue)}`
    if (currentFallbackId) return `${category.name} → Default: ${stationRouteLabel(currentFallbackId)}`
    return `${category.name} → Default not configured`
  }
  const inheritedRouteLabel = (item: RoutingConfig['menu_items'][number]) => {
    const category = categories.find(row => row.name.trim().toLowerCase() === (item.category || 'Other').trim().toLowerCase())
    const routeValue = category?.production_route_value || ROUTE_INHERIT_VALUE
    if (routeValue === ROUTE_NO_PRODUCTION_VALUE) return 'Category rule: no kitchen ticket'
    if (routeValue && routeValue !== ROUTE_MULTI_VALUE) {
      return `Category: ${stationRouteLabel(routeValue)}`
    }
    if (routeValue === ROUTE_MULTI_VALUE) return 'Category rule: multiple prep stations'
    return currentFallbackId ? `Default: ${stationRouteLabel(currentFallbackId)}` : 'No automatic route'
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && <p className="text-sm text-[rgb(var(--text-tertiary))]">Loading routing...</p>}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="label-mono text-[rgb(var(--gold))]">How ticket routing works</p>
        <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
          Categories point to a prep station, and that station points to a printer or KDS display. If hardware changes, update the station once instead of remapping every menu category.
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-sm font-medium text-[rgb(var(--text-primary))]">
          Menu category <span className="px-2 text-[rgb(var(--gold))]">→</span> Prep station <span className="px-2 text-[rgb(var(--gold))]">→</span> Printer or KDS
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          <div><span className="font-semibold text-[rgb(var(--text-primary))]">1. Stations</span><p className="mt-1 text-[rgb(var(--text-secondary))]">Create the places where food or drinks are prepared.</p></div>
          <div><span className="font-semibold text-[rgb(var(--text-primary))]">2. Outputs</span><p className="mt-1 text-[rgb(var(--text-secondary))]">Add printers or displays that receive tickets.</p></div>
          <div><span className="font-semibold text-[rgb(var(--text-primary))]">3. Connect</span><p className="mt-1 text-[rgb(var(--text-secondary))]">Connect each station, then choose the default.</p></div>
          <div><span className="font-semibold text-[rgb(var(--text-primary))]">4. Menu</span><p className="mt-1 text-[rgb(var(--text-secondary))]">Route categories and any item exceptions.</p></div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">1. Prep Stations</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Stations are where items are prepared, like Kitchen, Bar, Expo, or Dessert.</p>
          <input aria-label="New prep station name" placeholder="e.g. Kitchen, Bar, Dessert" className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35" value={stationName} onChange={event => setStationName(event.target.value)} />
          <button type="button" disabled={workingAction !== null || !stationName.trim()} className={primaryButtonClass} onClick={() => void createStation()}>
            {workingAction === 'station' ? 'Adding...' : 'Add station'}
          </button>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(var(--text-tertiary))]">Saved stations</p>
            <div className="mt-2 grid gap-2">
              {config?.stations.length ? config.stations.map(station => (
                <div key={station.id} className={`rounded-lg border px-3 py-2 text-xs ${recentlyAddedStation && ((recentlyAddedStation.id && recentlyAddedStation.id === station.id) || recentlyAddedStation.name.toLowerCase() === station.name.toLowerCase()) ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[rgb(var(--text-primary))]">{station.name}</span>
                    <span className="text-[rgb(var(--text-tertiary))]">{station.is_fallback ? 'Default' : recentlyAddedStation && ((recentlyAddedStation.id && recentlyAddedStation.id === station.id) || recentlyAddedStation.name.toLowerCase() === station.name.toLowerCase()) ? 'Just added' : 'Saved'}</span>
                  </div>
                  <p className="mt-1 text-[rgb(var(--text-tertiary))]">{outputNamesForStation(station.id).length ? `Output: ${outputNamesForStation(station.id).join(' + ')}` : 'Next: connect an output below'}</p>
                </div>
              )) : <span className="text-xs text-[rgb(var(--text-tertiary))]">None yet</span>}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">2. Printers & Displays</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Outputs are the hardware or display destinations that receive tickets from a station.</p>
          <select aria-label="Output type" className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" value={targetType} onChange={event => setTargetType(event.target.value as 'printer' | 'display')}>
            <option value="printer">Kitchen printer</option>
            <option value="display">KDS display</option>
          </select>
          <input aria-label="New output name" placeholder="e.g. Kitchen Printer" className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35" value={targetName} onChange={event => setTargetName(event.target.value)} />
          {targetType === 'printer' ? <><input aria-label="Printer host or IP" className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35" placeholder="Printer IP (optional during setup)" value={targetHost} onChange={event => setTargetHost(event.target.value)} /><p className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">Leave the IP blank to connect the physical printer later in Printing & Routing.</p></> : <p className="mt-2 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-[rgb(var(--text-tertiary))]">The KDS display uses Shire's durable display queue. Pair and assign the physical iPad later; no address is needed now.</p>}
          <button type="button" disabled={workingAction !== null || !targetName.trim()} className={primaryButtonClass} onClick={() => void createTarget()}>
            {workingAction === 'target' ? 'Adding...' : 'Add output'}
          </button>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(var(--text-tertiary))]">Saved outputs</p>
            <div className="mt-2 grid gap-2">
              {config?.targets.length ? config.targets.map(target => (
                <div key={target.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${recentlyAddedTarget && ((recentlyAddedTarget.id && recentlyAddedTarget.id === target.id) || recentlyAddedTarget.name.toLowerCase() === target.name.toLowerCase()) ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'}`}>
                  <span className="font-medium text-[rgb(var(--text-primary))]">{target.name}</span>
                  <span className="text-[rgb(var(--text-tertiary))]">{recentlyAddedTarget && ((recentlyAddedTarget.id && recentlyAddedTarget.id === target.id) || recentlyAddedTarget.name.toLowerCase() === target.name.toLowerCase()) ? 'Just added' : target.connection_type}</span>
                </div>
              )) : <span className="text-xs text-[rgb(var(--text-tertiary))]">None yet</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">3. Connect Stations to Outputs</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">
            Assign the printer or display each station should send tickets to.
          </p>
        </div>
        {(!stationOptions.length || !targetOptions.length) && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            {!stationOptions.length
              ? 'Add a prep station above before connecting outputs.'
              : 'Add a printer or display above before connecting it to a station.'}
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
                  <option value="">{working ? 'Saving...' : targetOptions.length ? 'Choose an output' : 'Add an output above first'}</option>
                  {targetOptions.map(target => (
                    <option key={target.id} value={target.id}>{target.name} · {target.target_type || 'output'}</option>
                  ))}
                </select>
              </div>
            )
          }) : (
            <p className="text-sm text-[rgb(var(--text-tertiary))]">No stations found yet.</p>
          )}
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${config?.fallback?.ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">4. Choose the Default Prep Station</p>
            <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
              {config?.fallback?.ok
                ? `Ready. Unmapped items go to ${config.fallback.station?.name || 'the default station'} and then to ${currentFallbackId ? outputNamesForStation(currentFallbackId).join(' + ') : 'its output'}.`
                : !stationOptions.length
                  ? 'Create a prep station above first.'
                  : !fallbackOptions.length
                    ? 'Connect at least one station to an output above before choosing the default.'
                    : currentFallbackNeedsOutput
                      ? `${config?.fallback?.station?.name || 'The current default'} needs an output. Connect it above or choose another connected station.`
                      : 'Choose where items should go when they have no category or item-specific route.'}
            </p>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Used when no more specific route exists</span>
            <select
              aria-label="Default prep station"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              value={currentFallbackId}
              onChange={event => void setFallbackStation(event.target.value)}
              disabled={!fallbackOptions.length || workingAction !== null}
            >
              <option value="">{!stationOptions.length ? 'Create a prep station first' : !fallbackOptions.length ? 'Connect a station to an output first' : 'Choose a default station'}</option>
              {currentFallbackNeedsOutput && <option value={currentFallbackId} disabled>{config?.fallback?.station?.name || 'Current default'} — connect an output first</option>}
              {fallbackOptions.map(station => (
                <option key={station.id} value={station.id}>{station.name} → {outputNamesForStation(station.id).join(' + ')}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">5. Route Menu Categories</p>
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
                  {categoryRouteLabel(category)}
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
                  <option key={station.id} value={station.id}>{station.name} → {outputNamesForStation(station.id).length ? outputNamesForStation(station.id).join(' + ') : 'No output connected'}</option>
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
                  {stationOptions.map(station => <option key={station.id} value={station.id}>{station.name} → {outputNamesForStation(station.id).length ? outputNamesForStation(station.id).join(' + ') : 'No output connected'}</option>)}
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

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Initial KDS timing</p>
        <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Choose the ticket-header timeline now. Ticket size remains at its deliberate default and can be adjusted later in Printing & Routing → Kitchen Displays.</p>
        {kdsDraft ? <div className="mt-4"><KdsTimingEditor colors={kdsDraft.settings?.ticket_age_colors} rushAfterSeconds={Number(kdsDraft.rush_after_seconds)} onColorsChange={(ticket_age_colors: any) => setKdsDraft((current: any) => ({ ...current, settings: { ...current.settings, ticket_age_colors } }))} onRushAfterChange={(rush_after_seconds: number) => setKdsDraft((current: any) => ({ ...current, rush_after_seconds }))} title="Initial ticket age colors" /></div> : <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">Create a prep station above to establish the initial KDS profile. No printer or paired iPad is required.</p>}
        {kdsError && <p role="alert" className="mt-3 text-sm text-red-300">{kdsError}</p>}
      </div>

      <button
        data-onboarding-save
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
              await persistKdsTiming()
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
