import { useEffect, useMemo, useState } from 'react'
import { collapseEntryWhitespace } from '@shire/settings'
import type { MenuCategoryData, UseOnboardingReturn } from '../../hooks/useOnboarding'
import { fetchPosApi } from '../../../shared/api/posClient'
import { CreatableCombobox, type CreatableComboboxOption } from '../../../shared/components/CreatableCombobox'
import { effectiveFireModeLabel, kdsDisplayGroupOptions, normalizeCategoryOptionLabel } from '../../../shared/menuCategoryOptions.js'
import {
  ROUTE_INHERIT_VALUE,
  ROUTE_MULTI_VALUE,
  ROUTE_NO_PRODUCTION_VALUE,
  explicitProductionRouteValue,
  productionRouteSelectionPayload,
} from '../../../dashboard/menuRouting.js'

interface MenuCategoriesStepProps {
  onboarding: UseOnboardingReturn
}

const inputClass = 'w-full min-w-0 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const FIRE_MODES = [
  ['immediate', 'Immediate'],
  ['hold', 'Hold'],
  ['manual', 'Manual'],
  ['by_course', 'By course'],
] as const

type RoutingConfig = {
  fallback?: { ok?: boolean; reason?: string | null; station?: { id: string; name: string } | null }
  stations: Array<{ id: string; name: string; is_active?: boolean; archived_at?: string | null }>
  targets: Array<{ id: string; is_active?: boolean; archived_at?: string | null; usage?: string }>
  station_targets: Array<{ station_id: string; target_id: string; is_active?: boolean; archived_at?: string | null }>
  routing_rules: Array<{ source_type: string; category?: string | null; station_id?: string | null; is_active?: boolean; archived_at?: string | null }>
  routing_exclusions: Array<{ source_type: string; category?: string | null; is_active?: boolean; archived_at?: string | null }>
}

const TAX_CLASS_LABELS: Record<string, string> = {
  prepared_food: 'Prepared food',
  merchandise: 'Merchandise',
  beer_on_premise: 'Beer — on premise',
  wine_on_premise: 'Wine — on premise',
  cider_on_premise: 'Cider — on premise',
  spirits_on_premise: 'Spirits — on premise',
  mixed_drink_on_premise: 'Mixed drinks — on premise',
  beer_off_premise: 'Beer — off premise',
  wine_off_premise: 'Wine — off premise',
  cider_off_premise: 'Cider — off premise',
  spirits_off_premise: 'Spirits — off premise',
  mixed_drink_off_premise: 'Mixed drinks — off premise',
}

function blankCategory(index: number): MenuCategoryData {
  return {
    name: `Custom Category ${index + 1}`,
    tax_rate_id: '',
    routing_station_id: '',
    routing_station_name: '',
    default_fire_mode: '',
    kds_display_group: '',
    is_active: true,
  }
}

function actionError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function MenuCategoriesStep({ onboarding }: MenuCategoriesStepProps) {
  const { data, updateData, saveMenuCategories, nextStep, isLoading, error } = onboarding
  const categories = data.menu_categories
  const restaurantId = onboarding.restaurantId
  const [routing, setRouting] = useState<RoutingConfig | null>(null)
  const [routingLoading, setRoutingLoading] = useState(true)
  const [routingError, setRoutingError] = useState('')
  const enabledTaxClasses = data.enabled_tax_classes || []
  const requiresTaxClassification = enabledTaxClasses.length > 1
  const classificationsComplete = !requiresTaxClassification || categories.every(category => (
    enabledTaxClasses.includes(category.tax_class || '')
  ))
  const defaultFireLabel = effectiveFireModeLabel(data.check_workflow_settings?.default_order_fire_mode)
  const kdsGroups = useMemo(() => kdsDisplayGroupOptions(categories), [categories])

  const loadRouting = async () => {
    if (!restaurantId) return null
    const response = await fetchPosApi<Record<string, unknown>>(
      restaurantId,
      `/restaurants/${restaurantId}/kitchen-routing`,
    )
    const next: RoutingConfig = {
      fallback: response?.fallback as RoutingConfig['fallback'],
      stations: Array.isArray(response?.stations) ? response.stations as RoutingConfig['stations'] : [],
      targets: Array.isArray(response?.targets) ? response.targets as RoutingConfig['targets'] : [],
      station_targets: Array.isArray(response?.station_targets) ? response.station_targets as RoutingConfig['station_targets'] : [],
      routing_rules: Array.isArray(response?.routing_rules) ? response.routing_rules as RoutingConfig['routing_rules'] : [],
      routing_exclusions: Array.isArray(response?.routing_exclusions) ? response.routing_exclusions as RoutingConfig['routing_exclusions'] : [],
    }
    setRouting(next)
    return next
  }

  useEffect(() => {
    let cancelled = false
    if (!restaurantId) {
      setRoutingLoading(false)
      setRoutingError('Create the restaurant before configuring menu routing.')
      return undefined
    }
    setRoutingLoading(true)
    setRoutingError('')
    loadRouting()
      .catch(loadError => {
        if (!cancelled) setRoutingError(actionError(loadError, 'Could not load prep stations.'))
      })
      .finally(() => {
        if (!cancelled) setRoutingLoading(false)
      })
    return () => {
      cancelled = true
    }
    // loadRouting intentionally captures only the current restaurant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const routeValueFor = (category: MenuCategoryData, includeProjection = true) => {
    if (Object.prototype.hasOwnProperty.call(category, 'production_route_value')) {
      return category.production_route_value || ROUTE_INHERIT_VALUE
    }
    return explicitProductionRouteValue({
      sourceType: 'category',
      category: category.name,
      rules: routing?.routing_rules || [],
      exclusions: routing?.routing_exclusions || [],
      projectedStationId: includeProjection ? category.routing_station_id : '',
    })
  }

  const activeStations = (routing?.stations || []).filter(station => station.is_active !== false && !station.archived_at)
  const activeTargetIds = new Set((routing?.targets || [])
    .filter(target => target.is_active !== false && !target.archived_at && ['kitchen', 'both'].includes(target.usage || 'kitchen'))
    .map(target => target.id))
  const stationHasOutput = new Set((routing?.station_targets || [])
    .filter(link => link.is_active !== false && !link.archived_at && activeTargetIds.has(link.target_id))
    .map(link => link.station_id))
  const fallbackName = routing?.fallback?.station?.name

  const prepOptionsFor = (category: MenuCategoryData): CreatableComboboxOption[] => {
    const value = routeValueFor(category)
    return [
      {
        value: ROUTE_INHERIT_VALUE,
        label: `Use restaurant fallback — ${fallbackName || 'not configured yet'}`,
        description: fallbackName && !routing?.fallback?.ok ? 'Its printer or display still needs configuration.' : 'No category-specific route is stored.',
      },
      {
        value: ROUTE_NO_PRODUCTION_VALUE,
        label: 'No kitchen ticket',
        description: 'For gift cards, retail, or anything that needs no prep ticket.',
      },
      ...(value === ROUTE_MULTI_VALUE ? [{ value: ROUTE_MULTI_VALUE, label: 'Multiple prep stations', description: 'Keep this existing route or edit it later in Printing & Routing.', disabled: true }] : []),
      ...activeStations.map(station => ({
        value: station.id,
        label: station.name,
        description: stationHasOutput.has(station.id) ? 'Printer or KDS output connected.' : 'Output is assigned later in Printing & Routing.',
      })),
    ]
  }

  const updateCategory = (index: number, patch: Partial<MenuCategoryData>) => {
    updateData({
      menu_categories: categories.map((category, currentIndex) =>
        currentIndex === index ? { ...category, ...patch } : category
      ),
    })
  }

  const removeCategory = (index: number) => {
    updateData({ menu_categories: categories.filter((_, currentIndex) => currentIndex !== index) })
  }

  const updatePrepRoute = (index: number, routeValue: string) => {
    if (routeValue === ROUTE_MULTI_VALUE) return
    const station = activeStations.find(candidate => candidate.id === routeValue)
    updateCategory(index, {
      production_route_value: routeValue,
      routing_station_id: station?.id || '',
      routing_station_name: station?.name || '',
    })
  }

  const createPrepStation = async (index: number, rawName: string) => {
    if (!restaurantId) throw new Error('Create the restaurant before adding a prep station.')
    const name = collapseEntryWhitespace(rawName)
    const existing = activeStations.find(station => station.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (existing) {
      updatePrepRoute(index, existing.id)
      return existing.id
    }
    setRoutingError('')
    try {
      const created = await fetchPosApi<{ id?: string; name?: string }>(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/stations`, {
        method: 'POST',
        body: JSON.stringify({ name, is_active: true, station_type: 'prep' }),
      })
      if (!created?.id) throw new Error('The prep station was created without an ID. Refresh and try again.')
      await loadRouting()
      updatePrepRoute(index, created.id)
      return created.id
    } catch (createError) {
      const message = actionError(createError, 'Could not create the prep station.')
      setRoutingError(message)
      throw new Error(message)
    }
  }

  const persistCanonicalRoutes = async (snapshot: MenuCategoryData[]) => {
    if (!restaurantId || !routing) throw new Error('Prep stations are still loading. Try again.')
    for (const category of snapshot) {
      const selected = routeValueFor(category)
      const canonical = explicitProductionRouteValue({
        sourceType: 'category',
        category: category.name,
        rules: routing.routing_rules,
        exclusions: routing.routing_exclusions,
      })
      if (selected === canonical || selected === ROUTE_MULTI_VALUE) continue
      await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/categories`, {
        method: 'PUT',
        body: JSON.stringify({
          category: category.name.trim(),
          ...productionRouteSelectionPayload(selected),
        }),
      })
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setRoutingError('')
    try {
      if (!routing) throw new Error('Prep stations could not be loaded. Refresh and try again.')
      const snapshot = categories.map(category => {
        const selected = routeValueFor(category)
        const station = activeStations.find(candidate => candidate.id === selected)
        return {
          ...category,
          routing_station_id: station?.id || '',
          routing_station_name: station?.name || '',
          default_fire_mode: category.default_fire_mode === 'inherit' ? '' : category.default_fire_mode,
          kds_display_group: normalizeCategoryOptionLabel(category.kds_display_group),
          production_route_value: selected,
        }
      })
      await saveMenuCategories(snapshot)
      await persistCanonicalRoutes(snapshot)
      nextStep()
    } catch (submitError) {
      setRoutingError(actionError(submitError, 'Could not save menu category routing.'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(routingError || error) && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {routingError || error}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Create the menu categories your restaurant actually uses. Prep station chooses who prepares an item; its printer or KDS output is connected later in Printing & Routing. Faded values are inherited defaults, while brighter values are choices saved specifically for that category.
        </p>
      </div>

      <div className="space-y-3">
        {categories.map((category, index) => (
          <div key={category.id || `menu-category-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Category name</span>
                <input
                  value={category.name}
                  onChange={(event) => updateCategory(index, { name: event.target.value })}
                  className={inputClass}
                  placeholder="Appetizers"
                />
              </label>
              <button
                type="button"
                onClick={() => removeCategory(index)}
                className="self-end rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
            <div className={`mt-3 grid gap-3 ${requiresTaxClassification ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {requiresTaxClassification && (
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Sales tax class</span>
                  <select
                    value={category.tax_class || ''}
                    onChange={(event) => updateCategory(index, { tax_class: event.target.value })}
                    className={inputClass}
                    required
                  >
                    <option value="">Choose class</option>
                    {enabledTaxClasses.map(taxClass => (
                      <option key={taxClass} value={taxClass} className="bg-[#1a1a1a]">
                        {TAX_CLASS_LABELS[taxClass] || taxClass}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Default prep station</span>
                <CreatableCombobox
                  ariaLabel={`${category.name || `Category ${index + 1}`} default prep station`}
                  value={routeValueFor(category)}
                  options={prepOptionsFor(category)}
                  inherited={routeValueFor(category) === ROUTE_INHERIT_VALUE}
                  disabled={routingLoading}
                  createNoun="prep station"
                  onChange={value => updatePrepRoute(index, value)}
                  onCreate={name => createPrepStation(index, name)}
                />
              </div>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Fire timing default</span>
                <select
                  value={category.default_fire_mode === 'inherit' ? '' : (category.default_fire_mode || '')}
                  onChange={(event) => updateCategory(index, { default_fire_mode: event.target.value as MenuCategoryData['default_fire_mode'] })}
                  className={`${inputClass} ${!category.default_fire_mode || category.default_fire_mode === 'inherit' ? 'text-[rgb(var(--text-tertiary))]' : ''}`}
                >
                  <option value="" className="bg-[#1a1a1a]">Use order default — {defaultFireLabel}</option>
                  {FIRE_MODES.map(([value, label]) => <option key={value} value={value} className="bg-[#1a1a1a]">{label}</option>)}
                </select>
              </label>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">KDS group</span>
                <CreatableCombobox
                  ariaLabel={`${category.name || `Category ${index + 1}`} KDS display group`}
                  value={category.kds_display_group || ''}
                  options={[
                    { value: '', label: `Use category name — ${category.name || 'unnamed category'}`, description: 'The KDS groups these tickets under the category name.' },
                    ...kdsGroups.map(group => ({ value: group, label: group })),
                  ]}
                  inherited={!category.kds_display_group}
                  createNoun="KDS group"
                  onChange={value => updateCategory(index, { kds_display_group: value })}
                  onCreate={name => {
                    const normalized = normalizeCategoryOptionLabel(name)
                    updateCategory(index, { kds_display_group: normalized })
                    return normalized
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => updateData({ menu_categories: [...categories, blankCategory(categories.length)] })}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] px-4 py-3 text-sm font-semibold text-[rgb(var(--text-primary))] transition hover:bg-[rgba(255,255,255,0.05)]"
        >
          Add category
        </button>
        <button
          type="submit"
          disabled={isLoading || routingLoading || !routing || !classificationsComplete}
          className="rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : routingLoading ? 'Loading prep stations...' : 'Continue'}
        </button>
      </div>
      {!classificationsComplete && (
        <p className="text-sm text-amber-200">Choose a sales tax class for every menu category. You are classifying what is sold—not entering a percentage.</p>
      )}
    </form>
  )
}
