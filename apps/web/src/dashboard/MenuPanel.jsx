import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../shared/lib/supabase'
import { queryClient, queryKeys, fetchCached, fetchWithSupabaseAuth, STALE_TIMES } from '../shared/query'
import {
  addGroupOption,
  archiveModifierGroup,
  createModifierGroup,
  fetchModifierGroups,
  removeGroupOption,
  replaceGroupItems,
  updateGroupOption,
  updateModifierGroup,
  wouldCreateCycle,
} from './data/menuGroups'
import { fetchCategoryColors, fetchItemImages, setCategoryColor } from './data/menuExtras'
import { MenuItemDetail } from './MenuItemDetail'
import {
  ColorSwatchPicker,
  DAYS_SHORT,
  Field,
  ItemChecklist,
  ItemThumb,
  MenuEmptyState,
  ModifierPicker,
  SectionShell,
  SelectInput,
  SmallButton,
  TextInput,
  bucketModifiersByCategory,
  cleanDecimal,
  cleanDigits,
  groupRulesSummary,
  modifierCategoryOf,
  money,
} from './components/menuUi'

const MENU_TABS = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'modifiers', label: 'Modifiers' },
  { id: 'groups', label: 'Modifier Groups' },
  { id: 'specials', label: 'Specials & Schedule' },
  { id: 'printing', label: 'Printing & Routing' },
]

const COURSE_OPTIONS = [
  { value: '', label: 'Course default' },
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'entree', label: 'Entree' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' },
  { value: 'side', label: 'Side' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'None' },
]

const defaultSpecialDraft = () => ({
  menu_item_id: '',
  display_name: '',
  note: '',
  special_price: '',
  schedule_kind: 'manual',
  days_of_week: [1, 2, 3, 4, 5],
  start_time: '',
  end_time: '',
  start_date: '',
  end_date: '',
  cycle_anchor_date: '',
  cycle_length_days: '',
  cycle_day_number: '',
  expires_at: '',
})

const defaultGroupDraft = () => ({
  name: '',
  min_selections: '0',
  max_selections: '',
  is_required: false,
  prompt_on_order: true,
  included_count: '0',
  overage_price: '',
})

// Read-only recursive preview of how a group prompts on the POS, following
// child_group_id edges. `seen` guards against cycles in existing data.
function GroupTree({ groupId, groupsById, modifiersById, depth = 0, seen }) {
  const group = groupsById[groupId]
  if (!group || depth > 8 || seen.has(groupId)) return null
  const nextSeen = new Set(seen)
  nextSeen.add(groupId)
  return (
    <div className={depth > 0 ? 'ml-4 mt-2 border-l border-dash-gold/25 pl-3' : ''}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-dash-cream">{group.name}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-dash-tertiary">{groupRulesSummary(group)}</span>
      </div>
      <div className="mt-1 space-y-1">
        {(group.options || []).map(option => {
          const modifier = modifiersById[option.modifier_id]
          return (
            <div key={option.modifier_id} className="text-sm text-dash-secondary">
              <span>
                {option.is_default ? '★ ' : ''}{modifier?.name || 'Modifier'}
                {Number(modifier?.price_delta) > 0 && <span className="text-dash-tertiary"> +{money(modifier.price_delta)}</span>}
                {option.child_group_id && <span className="text-dash-gold"> → then asks:</span>}
              </span>
              {option.child_group_id && (
                <GroupTree
                  groupId={option.child_group_id}
                  groupsById={groupsById}
                  modifiersById={modifiersById}
                  depth={depth + 1}
                  seen={nextSeen}
                />
              )}
            </div>
          )
        })}
        {(group.options || []).length === 0 && <p className="text-sm text-dash-tertiary">No options yet.</p>}
      </div>
    </div>
  )
}

// ── Modifier group editor card (Groups tab power view) ─────────────────────

function GroupCard({ group, groups, modifiers, menuItems, busy, onSave, onArchive, onLink, onAddModifiers, onCreateModifier }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(() => ({
    name: group.name,
    min_selections: String(group.min_selections ?? 0),
    max_selections: group.max_selections == null ? '' : String(group.max_selections),
    is_required: Boolean(group.is_required),
    prompt_on_order: group.prompt_on_order !== false,
    included_count: String(group.included_count ?? 0),
    overage_price: group.overage_price == null ? '' : String(group.overage_price),
  }))
  const modifiersById = useMemo(() => Object.fromEntries(modifiers.map(m => [m.id, m])), [modifiers])
  const groupsById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups])
  const attachedIds = useMemo(() => new Set(group.item_ids), [group])
  const nestableGroups = groups.filter(candidate =>
    candidate.id !== group.id && !wouldCreateCycle(groups, group.id, candidate.id))

  const saveFields = () => {
    const minSelections = Math.max(draft.is_required ? 1 : 0, Number(draft.min_selections) || 0)
    const maxSelections = draft.max_selections === '' ? null : Math.max(minSelections, Number(draft.max_selections) || 0)
    onSave(group.id, {
      name: draft.name.trim() || group.name,
      min_selections: minSelections,
      max_selections: maxSelections,
      is_required: draft.is_required,
      prompt_on_order: draft.is_required ? true : draft.prompt_on_order,
      included_count: Number(draft.included_count) || 0,
      overage_price: draft.overage_price === '' ? null : Number(draft.overage_price),
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-left" onClick={() => setExpanded(current => !current)}>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-dash-cream">{group.name}</h4>
            {group.is_required && <span className="rounded-full bg-dash-gold/15 px-2 py-0.5 text-[11px] font-semibold text-dash-gold">Required</span>}
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-dash-tertiary">
              {group.options.length} option{group.options.length === 1 ? '' : 's'} · used by {group.item_ids.length} item{group.item_ids.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-sm text-dash-tertiary">{groupRulesSummary(group)}</p>
        </button>
        <div className="flex gap-2">
          <SmallButton onClick={() => setExpanded(current => !current)}>{expanded ? 'Close' : 'Edit'}</SmallButton>
          <SmallButton variant="danger" onClick={() => onArchive(group.id)} disabled={busy}>Archive</SmallButton>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-5 border-t border-white/10 pt-4">
          <div className="space-y-3">
            <Field label="Question guests are asked">
              <TextInput value={draft.name} onChange={event => setDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Choose a side" />
            </Field>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-dash-secondary">
              <span>Guest picks at least</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={draft.min_selections} onChange={event => setDraft(prev => ({ ...prev, min_selections: cleanDigits(event.target.value) }))} />
              <span>and at most</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" placeholder="∞" value={draft.max_selections} onChange={event => setDraft(prev => ({ ...prev, max_selections: cleanDigits(event.target.value) }))} />
              <span className="text-dash-tertiary">·</span>
              <span>first</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={draft.included_count} onChange={event => setDraft(prev => ({ ...prev, included_count: cleanDigits(event.target.value) }))} />
              <span>are free, then $</span>
              <TextInput inputMode="decimal" className="!w-20 !px-2 !py-1.5 text-center" placeholder="0.00" value={draft.overage_price} onChange={event => setDraft(prev => ({ ...prev, overage_price: cleanDecimal(event.target.value) }))} />
              <span>each extra</span>
              <SmallButton
                variant={draft.is_required ? 'primary' : 'secondary'}
                onClick={() => setDraft(prev => ({ ...prev, is_required: !prev.is_required }))}
              >
                {draft.is_required ? 'Required' : 'Optional'}
              </SmallButton>
              <SmallButton variant="primary" onClick={saveFields} disabled={busy}>Save</SmallButton>
            </div>
          </div>

          <div>
            <p className="label-mono mb-2">Options in this group</p>
            <div className="space-y-2">
              {group.options.map(option => {
                const modifier = modifiersById[option.modifier_id]
                return (
                  <div key={option.modifier_id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 lg:grid-cols-[1.3fr_auto_1fr_1.3fr_auto] lg:items-center">
                    <div className="text-sm">
                      <span className="font-medium text-dash-cream">{modifier?.name || 'Modifier'}</span>
                      {Number(modifier?.price_delta) > 0 && <span className="ml-2 text-dash-tertiary">+{money(modifier.price_delta)}</span>}
                    </div>
                    <SmallButton
                      variant={option.is_default ? 'primary' : 'secondary'}
                      title="Pre-selected by default"
                      onClick={() => onLink(() => updateGroupOption(group.id, option.modifier_id, { is_default: !option.is_default }))}
                    >
                      {option.is_default ? '★ Default' : 'Default'}
                    </SmallButton>
                    <TextInput
                      inputMode="decimal"
                      defaultValue={option.overage_price == null ? '' : String(option.overage_price)}
                      placeholder="Extra $ override"
                      onBlur={event => {
                        const next = event.target.value === '' ? null : Number(cleanDecimal(event.target.value))
                        if (next !== option.overage_price) {
                          onLink(() => updateGroupOption(group.id, option.modifier_id, { overage_price: next }))
                        }
                      }}
                    />
                    <SelectInput
                      value={option.child_group_id || ''}
                      onChange={event => onLink(() => updateGroupOption(group.id, option.modifier_id, { child_group_id: event.target.value || null }))}
                    >
                      <option value="">No follow-up question</option>
                      {nestableGroups.map(candidate => (
                        <option key={candidate.id} value={candidate.id}>Then ask: {candidate.name}</option>
                      ))}
                      {option.child_group_id && !nestableGroups.some(candidate => candidate.id === option.child_group_id) && (
                        <option value={option.child_group_id}>Then ask: {groupsById[option.child_group_id]?.name || 'Nested group'}</option>
                      )}
                    </SelectInput>
                    <SmallButton variant="danger" onClick={() => onLink(() => removeGroupOption(group.id, option.modifier_id))}>Remove</SmallButton>
                  </div>
                )
              })}
              {group.options.length === 0 && <p className="text-sm text-dash-tertiary">Add modifiers below to give this question answers.</p>}
            </div>
            <div className="mt-3">
              <ModifierPicker
                modifiers={modifiers}
                excludeIds={new Set(group.options.map(option => option.modifier_id))}
                busy={busy}
                onAddExisting={ids => onAddModifiers(ids)}
                onCreateNew={draft => onCreateModifier(draft)}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="label-mono mb-2">Applies to items</p>
              <ItemChecklist
                menuItems={menuItems}
                selectedIds={attachedIds}
                onToggle={itemId => {
                  const next = attachedIds.has(itemId)
                    ? group.item_ids.filter(id => id !== itemId)
                    : [...group.item_ids, itemId]
                  onLink(() => replaceGroupItems(group.id, next))
                }}
              />
            </div>
            <div>
              <p className="label-mono mb-2">Guest flow preview</p>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <GroupTree groupId={group.id} groupsById={groupsById} modifiersById={modifiersById} seen={new Set()} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────────

export function MenuPanel({ restaurantId }) {
  const [activeTab, setActiveTab] = useState('items')
  const [menuItems, setMenuItems] = useState([])
  const [itemImages, setItemImages] = useState({})
  const [categories, setCategories] = useState([])
  const [categoryColors, setCategoryColors] = useState({})
  const [taxRates, setTaxRates] = useState([])
  const [modifiers, setModifiers] = useState([])
  const [groups, setGroups] = useState([])
  const [specials, setSpecials] = useState([])
  const [routing, setRouting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedItemId, setSelectedItemId] = useState(null)

  const [itemSearch, setItemSearch] = useState('')
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all')
  const [itemAvailabilityFilter, setItemAvailabilityFilter] = useState('all')
  const [itemDraft, setItemDraft] = useState({ name: '', category: '', price: '' })

  const [modifierDraft, setModifierDraft] = useState({ name: '', price_delta: '', category: '', item_ids: new Set() })
  const [groupDraft, setGroupDraft] = useState(() => defaultGroupDraft())
  const [specialDraft, setSpecialDraft] = useState(() => defaultSpecialDraft())
  const [scheduleItemId, setScheduleItemId] = useState('')
  const [routingItemSearch, setRoutingItemSearch] = useState('')

  const api = (path, init) => fetchWithSupabaseAuth(path, init)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  const loadItems = async (force = false) => {
    const rows = await fetchCached(
      queryKeys.menuItems(restaurantId),
      () => api(`/restaurants/${restaurantId}/menu/items`),
      force ? 0 : STALE_TIMES.setup,
    )
    setMenuItems(Array.isArray(rows) ? rows : [])
  }

  // image_url is portal-managed and absent from the ML API response; merged in
  // separately. Fails soft until the images/colors migration is applied.
  const loadImages = async () => {
    try {
      setItemImages(await fetchItemImages(restaurantId))
    } catch {
      setItemImages({})
    }
  }

  const loadCategories = async (force = false) => {
    const data = await fetchCached(
      queryKeys.menuCategories(restaurantId),
      () => api(`/restaurants/${restaurantId}/menu/categories`),
      force ? 0 : STALE_TIMES.setup,
    )
    setCategories(Array.isArray(data) ? data : (data?.categories || []))
    setTaxRates(Array.isArray(data?.tax_rates) ? data.tax_rates : [])
    try {
      setCategoryColors(await fetchCategoryColors(restaurantId))
    } catch {
      setCategoryColors({})
    }
  }

  const loadModifiers = async () => {
    const rows = await api(`/restaurants/${restaurantId}/menu/modifiers`)
    setModifiers(Array.isArray(rows) ? rows : [])
  }

  const loadGroups = async () => {
    setGroups(await fetchModifierGroups(restaurantId))
  }

  const loadSpecials = async () => {
    const { data, error: specialsError } = await supabase
      .from('pos_daily_specials')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true })
    if (specialsError) throw specialsError
    setSpecials(data || [])
  }

  const loadRouting = async (force = false) => {
    const data = await fetchCached(
      queryKeys.kitchenRouting(restaurantId),
      () => api(`/restaurants/${restaurantId}/kitchen-routing`),
      force ? 0 : STALE_TIMES.setup,
    )
    setRouting(data)
  }

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setLoading(true)
    setError('')
    setSelectedItemId(null)
    Promise.allSettled([
      loadItems(),
      loadImages(),
      loadCategories(),
      loadModifiers(),
      loadGroups(),
      loadSpecials(),
      loadRouting(),
    ]).then(results => {
      if (cancelled) return
      if (results.some(result => result.status === 'rejected')) {
        setError('Some menu data failed to load. Try again or refresh.')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: queryKeys.menuItems(restaurantId) })
  const invalidateCategories = () => queryClient.invalidateQueries({ queryKey: queryKeys.menuCategories(restaurantId) })

  const run = async (work, successMessage) => {
    setBusy(true)
    setError('')
    try {
      await work()
      if (successMessage) setNotice(successMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const stations = routing?.stations || []
  const stationsById = useMemo(() => Object.fromEntries(stations.map(station => [station.id, station])), [stations])

  const mergedItems = useMemo(
    () => menuItems.map(item => ({ ...item, image_url: itemImages[item.id] ?? null })),
    [menuItems, itemImages],
  )
  const mergedCategories = useMemo(
    () => categories.map(category => ({ ...category, color: categoryColors[category.id] ?? category.color ?? null })),
    [categories, categoryColors],
  )
  const categoryNames = useMemo(() => {
    const names = new Set(mergedCategories.map(category => category.name).filter(Boolean))
    for (const item of menuItems) if (item.category) names.add(item.category)
    return Array.from(names).sort()
  }, [mergedCategories, menuItems])
  const categoriesByName = useMemo(
    () => Object.fromEntries(mergedCategories.filter(category => category.name).map(category => [category.name, category])),
    [mergedCategories],
  )
  const activeSpecials = useMemo(
    () => specials.filter(special => {
      if (!special.is_active) return false
      if (special.expires_at && new Date(special.expires_at).getTime() <= Date.now()) return false
      return true
    }),
    [specials],
  )
  const activeSpecialItemIds = useMemo(
    () => new Set(activeSpecials.map(special => special.menu_item_id)),
    [activeSpecials],
  )

  // ── Items ────────────────────────────────────────────────────────────────

  const patchItem = (itemId, patch, message) => run(async () => {
    const updated = await api(`/restaurants/${restaurantId}/menu/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    setMenuItems(prev => prev.map(item => (item.id === itemId ? { ...item, ...updated } : item)))
    invalidateItems()
  }, message)

  const createItem = () => {
    if (!itemDraft.name.trim() || itemDraft.price === '') {
      setError('New items need at least a name and a price.')
      return
    }
    return run(async () => {
      const created = await api(`/restaurants/${restaurantId}/menu/items/single`, {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id: restaurantId,
          name: itemDraft.name.trim(),
          category: itemDraft.category.trim() || 'Other',
          price: Number(itemDraft.price) || 0,
          is_available: true,
        }),
      })
      setItemDraft({ name: '', category: itemDraft.category, price: '' })
      invalidateItems()
      await loadItems(true)
      if (created?.id) setSelectedItemId(created.id)
    }, 'Item added — fill in the details.')
  }

  const deleteItem = (itemId) => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/items/${itemId}`, { method: 'DELETE' })
    setMenuItems(prev => prev.filter(item => item.id !== itemId))
    invalidateItems()
  }, 'Item removed.')

  const filteredItems = useMemo(() => {
    const needle = itemSearch.trim().toLowerCase()
    return mergedItems.filter(item => {
      if (itemCategoryFilter !== 'all' && (item.category || 'Other') !== itemCategoryFilter) return false
      if (itemAvailabilityFilter === 'available' && item.is_available === false) return false
      if (itemAvailabilityFilter === '86d' && item.is_available !== false) return false
      if (itemAvailabilityFilter === 'specials' && !activeSpecialItemIds.has(item.id)) return false
      if (!needle) return true
      return item.name.toLowerCase().includes(needle)
        || (item.description || '').toLowerCase().includes(needle)
        || (item.category || '').toLowerCase().includes(needle)
    })
  }, [mergedItems, itemSearch, itemCategoryFilter, itemAvailabilityFilter, activeSpecialItemIds])

  const itemsByCategory = useMemo(() => {
    const buckets = {}
    for (const item of filteredItems) {
      ;(buckets[item.category || 'Other'] ||= []).push(item)
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredItems])

  const selectedItem = selectedItemId ? mergedItems.find(item => item.id === selectedItemId) : null
  const nestedReadiness = useMemo(() => {
    const groupsById = Object.fromEntries(groups.map(group => [group.id, group]))
    const parentEdges = []
    const childUseCount = {}
    for (const group of groups) {
      for (const option of group.options || []) {
        if (!option.child_group_id) continue
        const child = groupsById[option.child_group_id]
        parentEdges.push({ group, option, child })
        childUseCount[option.child_group_id] = (childUseCount[option.child_group_id] || 0) + 1
      }
    }

    const emptyChildren = parentEdges.filter(edge => !edge.child || (edge.child.options || []).length === 0)
    const requiredChildren = parentEdges.filter(edge => edge.child && (edge.child.is_required || Number(edge.child.min_selections || 0) > 0))
    const sharedChildren = parentEdges.filter(edge =>
      edge.child &&
      ((edge.child.item_ids || []).length > 1 || childUseCount[edge.child.id] > 1)
    )
    const chains = parentEdges.filter(edge =>
      edge.child && (edge.child.options || []).some(childOption => childOption.child_group_id)
    )

    return {
      edgeCount: parentEdges.length,
      emptyChildren,
      requiredChildren,
      sharedChildren,
      chains,
    }
  }, [groups])

  // ── Categories ───────────────────────────────────────────────────────────

  const saveCategories = (nextCategories) => run(async () => {
    const payload = {
      categories: nextCategories
        .filter(category => category.name && category.name.trim())
        .map(category => ({
          id: category.id || undefined,
          name: category.name.trim(),
          tax_rate_id: category.tax_rate_id || null,
          routing_station_id: category.routing_station_id || null,
          routing_station_name: category.routing_station_name || stationsById[category.routing_station_id]?.name || null,
          default_course_type: category.default_course_type || null,
          default_fire_mode: category.default_fire_mode || null,
          prep_time_minutes: category.prep_time_minutes === '' || category.prep_time_minutes == null ? null : Number(category.prep_time_minutes),
          kds_display_group: category.kds_display_group || null,
          is_active: true,
        })),
    }
    const saved = await api(`/restaurants/${restaurantId}/menu/categories`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    setCategories(Array.isArray(saved) ? saved : (saved?.categories || []))
    invalidateCategories()
  }, 'Categories saved.')

  const updateCategory = (index, patch) => {
    setCategories(prev => prev.map((category, currentIndex) => (currentIndex === index ? { ...category, ...patch } : category)))
  }

  // The taxes-charges PUT is a full replace (it deactivates anything omitted),
  // so creating one rate inline means re-fetching both lists and sending them
  // back with the new rate appended.
  const createTaxRate = (name, ratePercent) => run(async () => {
    const current = await api(`/restaurants/${restaurantId}/taxes-charges`)
    await api(`/restaurants/${restaurantId}/taxes-charges`, {
      method: 'PUT',
      body: JSON.stringify({
        tax_rates: [
          ...(current?.tax_rates || []).map(row => ({
            id: row.id,
            name: row.name,
            rate: Number(row.rate) || 0,
            applies_to: row.applies_to || 'all',
            is_default: Boolean(row.is_default),
            is_inclusive: Boolean(row.is_inclusive),
            is_active: true,
          })),
          { name, rate: ratePercent, applies_to: 'all', is_default: false, is_inclusive: false, is_active: true },
        ],
        service_charges: (current?.service_charges || []).map(row => ({
          id: row.id,
          name: row.name,
          charge_type: row.charge_type || 'percentage',
          amount: Number(row.amount) || 0,
          applies_to: row.applies_to || 'all',
          taxable: Boolean(row.taxable),
          auto_apply: Boolean(row.auto_apply),
          is_tip: Boolean(row.is_tip),
          is_active: true,
        })),
      }),
    })
    queryClient.invalidateQueries({ queryKey: queryKeys.taxesCharges(restaurantId) })
    await loadCategories(true)
  }, `Tax rate "${name}" created — assign it to a category below and save.`)

  const pickCategoryColor = (category, color) => run(async () => {
    await setCategoryColor(restaurantId, category.id, color)
    setCategoryColors(prev => {
      const next = { ...prev }
      if (color) next[category.id] = color
      else delete next[category.id]
      return next
    })
  }, color ? 'Category color set.' : 'Category color cleared.')

  // ── Modifiers ────────────────────────────────────────────────────────────

  const createModifier = () => {
    if (!modifierDraft.name.trim()) {
      setError('Give the modifier a name first.')
      return
    }
    return run(async () => {
      const created = await api(`/restaurants/${restaurantId}/menu/modifiers`, {
        method: 'POST',
        body: JSON.stringify({
          name: modifierDraft.name.trim(),
          price_delta: modifierDraft.price_delta === '' ? 0 : Number(modifierDraft.price_delta),
          group_name: modifierDraft.category.trim() || 'Add-ons',
          is_active: true,
        }),
      })
      if (created?.id && modifierDraft.item_ids.size > 0) {
        await api(`/restaurants/${restaurantId}/menu/modifiers/${created.id}/items`, {
          method: 'PUT',
          body: JSON.stringify({ item_ids: Array.from(modifierDraft.item_ids) }),
        })
      }
      setModifierDraft(prev => ({ name: '', price_delta: '', category: prev.category, item_ids: new Set() }))
      await loadModifiers()
    }, 'Modifier added.')
  }

  const updateModifier = (modifierId, patch) => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/modifiers/${modifierId}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    await loadModifiers()
  })

  const replaceModifierItems = (modifierId, itemIds) => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/modifiers/${modifierId}/items`, {
      method: 'PUT',
      body: JSON.stringify({ item_ids: itemIds }),
    })
    await loadModifiers()
  })

  const deleteModifier = (modifierId) => run(async () => {
    await api(`/restaurants/${restaurantId}/menu/modifiers/${modifierId}`, { method: 'DELETE' })
    await loadModifiers()
    await loadGroups()
  }, 'Modifier removed.')

  // ── Modifier groups ──────────────────────────────────────────────────────

  const createGroup = () => {
    if (!groupDraft.name.trim()) {
      setError('Name the question first — e.g. "Choose a side".')
      return
    }
    return run(async () => {
      const minSelections = Math.max(groupDraft.is_required ? 1 : 0, Number(groupDraft.min_selections) || 0)
      await createModifierGroup(restaurantId, {
        name: groupDraft.name.trim(),
        min_selections: minSelections,
        max_selections: groupDraft.max_selections === '' ? null : Math.max(minSelections, Number(groupDraft.max_selections) || 0),
        is_required: groupDraft.is_required,
        prompt_on_order: groupDraft.prompt_on_order,
        included_count: Number(groupDraft.included_count) || 0,
        overage_price: groupDraft.overage_price === '' ? null : Number(groupDraft.overage_price),
        display_order: groups.length,
      })
      setGroupDraft(defaultGroupDraft())
      await loadGroups()
    }, 'Modifier group created.')
  }

  const saveGroup = (groupId, patch) => run(async () => {
    await updateModifierGroup(groupId, patch)
    await loadGroups()
  }, 'Group saved.')

  const archiveGroup = (groupId) => run(async () => {
    await archiveModifierGroup(groupId)
    await loadGroups()
  }, 'Group archived.')

  const runGroupLink = (work) => run(async () => {
    await work()
    await loadGroups()
  })

  const addModifiersToGroup = (group, modifierIds) => run(async () => {
    let order = group.options.length
    for (const modifierId of modifierIds) {
      if (group.options.some(option => option.modifier_id === modifierId)) continue
      await addGroupOption(group.id, modifierId, { display_order: order })
      order += 1
    }
    await loadGroups()
  }, modifierIds.length > 1 ? 'Options added.' : 'Option added.')

  const createModifierIntoGroup = (group, draft) => run(async () => {
    const created = await api(`/restaurants/${restaurantId}/menu/modifiers`, {
      method: 'POST',
      body: JSON.stringify({ ...draft, is_active: true }),
    })
    if (created?.id) await addGroupOption(group.id, created.id, { display_order: group.options.length })
    await loadModifiers()
    await loadGroups()
  }, 'Modifier created and added.')

  // ── Specials (tab-level scheduling) ──────────────────────────────────────

  const auditSpecial = async (eventType, specialId, before, after) => {
    try {
      await supabase.from('pos_daily_special_events').insert({
        restaurant_id: restaurantId,
        daily_special_id: specialId,
        event_type: eventType,
        before_data: before,
        after_data: after,
      })
    } catch {
      // Audit is best-effort; the special itself already saved.
    }
  }

  const createSpecial = () => {
    if (!specialDraft.menu_item_id) {
      setError('Choose a base menu item for the special first.')
      return
    }
    if (specialDraft.schedule_kind === 'cycle' && (!specialDraft.cycle_anchor_date || !specialDraft.cycle_length_days || !specialDraft.cycle_day_number)) {
      setError('Cycle specials need an anchor date, cycle length, and special day.')
      return
    }
    return run(async () => {
      const payload = {
        restaurant_id: restaurantId,
        menu_item_id: specialDraft.menu_item_id,
        display_name: specialDraft.display_name.trim() || null,
        note: specialDraft.note.trim() || null,
        special_price: specialDraft.special_price === '' ? null : Number(specialDraft.special_price),
        schedule_kind: specialDraft.schedule_kind,
        days_of_week: specialDraft.schedule_kind === 'weekly' ? specialDraft.days_of_week : [0, 1, 2, 3, 4, 5, 6],
        start_time: specialDraft.start_time || null,
        end_time: specialDraft.end_time || null,
        start_date: specialDraft.schedule_kind === 'date_window' ? (specialDraft.start_date || null) : null,
        end_date: specialDraft.schedule_kind === 'date_window' ? (specialDraft.end_date || null) : null,
        cycle_anchor_date: specialDraft.schedule_kind === 'cycle' ? specialDraft.cycle_anchor_date : null,
        cycle_length_days: specialDraft.schedule_kind === 'cycle' ? Number(specialDraft.cycle_length_days) : null,
        cycle_day_number: specialDraft.schedule_kind === 'cycle' ? Number(specialDraft.cycle_day_number) : null,
        expires_at: specialDraft.expires_at ? new Date(specialDraft.expires_at).toISOString() : null,
        sort_order: specials.length,
        is_active: true,
      }
      const { data, error: insertError } = await supabase.from('pos_daily_specials').insert(payload).select('*').single()
      if (insertError) throw insertError
      await auditSpecial('created', data.id, null, data)
      setSpecialDraft(defaultSpecialDraft())
      await loadSpecials()
    }, 'Special saved.')
  }

  const updateSpecial = (special, patch) => run(async () => {
    const { data, error: updateError } = await supabase
      .from('pos_daily_specials')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', special.id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single()
    if (updateError) throw updateError
    await auditSpecial('updated', special.id, special, data)
    await loadSpecials()
  })

  const archiveSpecial = (special) => run(async () => {
    const { error: archiveError } = await supabase
      .from('pos_daily_specials')
      .update({ archived_at: new Date().toISOString(), is_active: false })
      .eq('id', special.id)
      .eq('restaurant_id', restaurantId)
    if (archiveError) throw archiveError
    await auditSpecial('archived', special.id, special, null)
    await loadSpecials()
  }, 'Special archived.')

  const scheduledItems = mergedItems.filter(item => item.availability_mode && item.availability_mode !== 'always')

  // ── Printing / routing ───────────────────────────────────────────────────

  const routeCategory = (categoryName, stationId) => run(async () => {
    await api(`/restaurants/${restaurantId}/kitchen-routing/rules`, {
      method: 'POST',
      body: JSON.stringify({ source_type: 'category', category: categoryName, station_id: stationId, target_types: ['printer', 'display'] }),
    })
    invalidateCategories()
    await Promise.all([loadRouting(true), loadCategories(true)])
  }, 'Category routed.')

  const createStation = (name) => run(async () => {
    await api(`/restaurants/${restaurantId}/kitchen-routing/stations`, {
      method: 'POST',
      body: JSON.stringify({ name, is_active: true }),
    })
    await loadRouting(true)
  }, 'Station added.')

  const createTarget = (name, host) => run(async () => {
    await api(`/restaurants/${restaurantId}/kitchen-routing/targets`, {
      method: 'POST',
      body: JSON.stringify({
        name: name || 'Kitchen Printer',
        target_type: 'printer',
        connection_type: host ? 'network' : 'dummy',
        config: host ? { host, port: 9100, profile: 'TM-T88V' } : {},
        is_active: true,
      }),
    })
    await loadRouting(true)
  }, 'Printer target added.')

  const assignTarget = (stationId, targetId) => run(async () => {
    await api(`/restaurants/${restaurantId}/kitchen-routing/station-targets`, {
      method: 'POST',
      body: JSON.stringify({ station_id: stationId, target_id: targetId, priority: 0, is_active: true }),
    })
    await loadRouting(true)
  }, 'Printer assigned to station.')

  const routingItems = useMemo(() => {
    const needle = routingItemSearch.trim().toLowerCase()
    if (!needle) return mergedItems
    return mergedItems.filter(item => item.name.toLowerCase().includes(needle) || (item.category || '').toLowerCase().includes(needle))
  }, [mergedItems, routingItemSearch])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-mono">Menu Workspace</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Menu</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-dash-secondary">
            Click any item to open its full editor — photo, availability, specials, and modifier questions with unlimited follow-ups. Changes reach the POS on its next sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-dash-tertiary">
          <span className="rounded-full border border-white/10 px-3 py-1">{menuItems.length} items</span>
          <span className="rounded-full border border-white/10 px-3 py-1">{modifiers.length} modifiers</span>
          <span className="rounded-full border border-white/10 px-3 py-1">{groups.length} questions</span>
          <span className="rounded-full border border-white/10 px-3 py-1">{activeSpecials.length} live specials</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MENU_TABS.map(tab => (
          <SmallButton
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            onClick={() => {
              setActiveTab(tab.id)
              setSelectedItemId(null)
            }}
          >
            {tab.label}
          </SmallButton>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{notice}</div>}
      {loading && <div className="text-sm text-dash-tertiary">Loading menu...</div>}

      {!loading && activeTab === 'items' && selectedItem && (
        <MenuItemDetail
          key={selectedItem.id}
          restaurantId={restaurantId}
          item={selectedItem}
          categories={mergedCategories}
          categoryNames={categoryNames}
          stations={stations}
          groups={groups}
          modifiers={modifiers}
          specials={specials}
          busy={busy}
          onBack={() => setSelectedItemId(null)}
          patchItem={patchItem}
          deleteItem={deleteItem}
          run={run}
          reloadGroups={loadGroups}
          reloadModifiers={loadModifiers}
          reloadSpecials={loadSpecials}
          reloadImages={loadImages}
        />
      )}

      {!loading && activeTab === 'items' && !selectedItem && (
        <SectionShell
          title="Items"
          description="Click an item to open its full editor. Quick-add below, quick-86 on every row."
        >
          <div className="mb-4 grid gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 md:grid-cols-[1.4fr_1fr_120px_auto]">
            <TextInput value={itemDraft.name} onChange={event => setItemDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="New item name" />
            <TextInput value={itemDraft.category} list="menu-panel-categories" onChange={event => setItemDraft(prev => ({ ...prev, category: event.target.value }))} placeholder="Category" />
            <TextInput inputMode="decimal" value={itemDraft.price} onChange={event => setItemDraft(prev => ({ ...prev, price: cleanDecimal(event.target.value) }))} placeholder="12.00" />
            <SmallButton variant="primary" onClick={() => void createItem()} disabled={busy}>Add & edit</SmallButton>
            <datalist id="menu-panel-categories">
              {categoryNames.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
            <TextInput value={itemSearch} onChange={event => setItemSearch(event.target.value)} placeholder="Search items, descriptions, categories..." />
            <SelectInput value={itemCategoryFilter} onChange={event => setItemCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {categoryNames.map(name => <option key={name} value={name}>{name}</option>)}
            </SelectInput>
            <SelectInput value={itemAvailabilityFilter} onChange={event => setItemAvailabilityFilter(event.target.value)}>
              <option value="all">All items</option>
              <option value="available">Available</option>
              <option value="86d">86'd only</option>
              <option value="specials">Running a special</option>
            </SelectInput>
          </div>

          {itemsByCategory.length === 0 ? (
            <MenuEmptyState title="No items match">
              Add your first item above, or loosen the search and filters.
            </MenuEmptyState>
          ) : (
            <div className="space-y-6">
              {itemsByCategory.map(([categoryName, items]) => {
                const categoryColor = categoriesByName[categoryName]?.color || null
                return (
                  <div key={categoryName}>
                    <div className="mb-2 flex items-center gap-2">
                      {categoryColor && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColor }} />}
                      <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{categoryName}</h4>
                      <span className="text-xs text-dash-tertiary">{items.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map(item => (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedItemId(item.id)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') setSelectedItemId(item.id)
                          }}
                          className={[
                            'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-dash-gold/40 hover:bg-white/[0.04]',
                            item.is_available === false ? 'border-amber-300/25 bg-amber-300/[0.04]' : 'border-white/10 bg-white/[0.025]',
                          ].join(' ')}
                        >
                          <ItemThumb item={item} color={categoryColor} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-dash-cream">{item.name}</span>
                              {activeSpecialItemIds.has(item.id) && (
                                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">Special</span>
                              )}
                              {item.availability_mode && item.availability_mode !== 'always' && (
                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-dash-tertiary">Scheduled</span>
                              )}
                            </div>
                            {item.description && <p className="truncate text-sm text-dash-tertiary">{item.description}</p>}
                          </div>
                          <span className="text-sm font-semibold text-dash-cream">{money(item.price)}</span>
                          <span onClick={event => event.stopPropagation()}>
                            <SmallButton
                              variant={item.is_available === false ? 'danger' : 'secondary'}
                              title={item.is_available === false ? 'Item is 86’d — tap to restore' : 'Take item off the menu (86)'}
                              onClick={() => void patchItem(item.id, { is_available: item.is_available === false }, item.is_available === false ? 'Item restored.' : "Item 86'd.")}
                            >
                              {item.is_available === false ? "86'd" : 'Available'}
                            </SmallButton>
                          </span>
                          <span className="text-dash-tertiary">›</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionShell>
      )}

      {!loading && activeTab === 'categories' && (
        <SectionShell
          title="Categories"
          description="How the menu is organized on the POS. Pick a button color, a tax rate (liquor at 15%, everything else at the default), a default prep station, and a default course — items inherit them unless overridden."
          actions={<SmallButton variant="primary" onClick={() => void saveCategories(categories)} disabled={busy}>{busy ? 'Saving...' : 'Save categories'}</SmallButton>}
        >
          <NewTaxRateInline busy={busy} onCreate={(name, rate) => void createTaxRate(name, rate)} />
          <div className="space-y-3">
            {mergedCategories.map((category, index) => (
              <div key={category.id || `${category.name}:${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_120px_auto]">
                  <TextInput value={category.name || ''} onChange={event => updateCategory(index, { name: event.target.value })} placeholder="Appetizers" />
                  <SelectInput
                    value={category.routing_station_id || ''}
                    onChange={event => updateCategory(index, { routing_station_id: event.target.value, routing_station_name: stationsById[event.target.value]?.name || '' })}
                  >
                    <option value="">No default station</option>
                    {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                  </SelectInput>
                  <SelectInput value={category.default_course_type || ''} onChange={event => updateCategory(index, { default_course_type: event.target.value })}>
                    {COURSE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </SelectInput>
                  <TextInput
                    value={category.prep_time_minutes == null ? '' : String(category.prep_time_minutes)}
                    onChange={event => updateCategory(index, { prep_time_minutes: cleanDigits(event.target.value) })}
                    placeholder="Prep min"
                  />
                  <SmallButton variant="danger" onClick={() => setCategories(prev => prev.filter((_, currentIndex) => currentIndex !== index))}>Remove</SmallButton>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="label-mono">Button color</span>
                    <ColorSwatchPicker
                      value={category.color}
                      disabled={!category.id || busy}
                      onPick={color => category.id && void pickCategoryColor(category, color)}
                    />
                    {!category.id && <span className="text-xs text-dash-tertiary">Save categories first to pick a color.</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="label-mono">Tax</span>
                    <SelectInput
                      className="!w-auto !py-2"
                      title="Every item in this category is taxed at this rate on the POS"
                      value={category.tax_rate_id || ''}
                      onChange={event => updateCategory(index, { tax_rate_id: event.target.value || null })}
                    >
                      <option value="">Store default rate</option>
                      {taxRates.map(rate => (
                        <option key={rate.id} value={rate.id}>{rate.name} · {Number(rate.rate)}%</option>
                      ))}
                    </SelectInput>
                  </div>
                </div>
              </div>
            ))}
            {mergedCategories.length === 0 && (
              <MenuEmptyState title="No categories yet">
                Add your first category — Appetizers, Entrees, Drinks — then save.
              </MenuEmptyState>
            )}
          </div>
          <div className="mt-4">
            <SmallButton onClick={() => setCategories(prev => [...prev, { name: '', tax_rate_id: '', routing_station_id: '', routing_station_name: '', default_course_type: '', default_fire_mode: 'inherit', prep_time_minutes: '', kds_display_group: '', is_active: true }])}>
              Add category
            </SmallButton>
          </div>
        </SectionShell>
      )}

      {!loading && activeTab === 'modifiers' && (
        <SectionShell
          title="Modifiers"
          description="Individual add-ons and choices — Extra cheese, Ranch, Medium rare — organized into categories like Sauces or Temperatures. Type a new category name anywhere to create it. Attach modifiers to items here, or right inside an item's editor."
        >
          <datalist id="menu-modifier-categories">
            {Array.from(new Set(modifiers.map(modifierCategoryOf))).sort().map(name => <option key={name} value={name} />)}
          </datalist>
          <div className="mb-5 grid gap-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 lg:grid-cols-[1fr_120px_160px_1.3fr_auto]">
            <Field label="Modifier name">
              <TextInput value={modifierDraft.name} onChange={event => setModifierDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="Extra cheese" />
            </Field>
            <Field label="Price +$">
              <TextInput inputMode="decimal" value={modifierDraft.price_delta} onChange={event => setModifierDraft(prev => ({ ...prev, price_delta: cleanDecimal(event.target.value) }))} placeholder="0.00" />
            </Field>
            <Field label="Category">
              <TextInput list="menu-modifier-categories" value={modifierDraft.category} onChange={event => setModifierDraft(prev => ({ ...prev, category: event.target.value }))} placeholder="Add-ons" />
            </Field>
            <div>
              <p className="label-mono mb-2">Applies to ({modifierDraft.item_ids.size} items)</p>
              <ItemChecklist
                menuItems={mergedItems}
                selectedIds={modifierDraft.item_ids}
                onToggle={itemId => setModifierDraft(prev => {
                  const next = new Set(prev.item_ids)
                  if (next.has(itemId)) next.delete(itemId)
                  else next.add(itemId)
                  return { ...prev, item_ids: next }
                })}
              />
            </div>
            <div className="flex items-end">
              <SmallButton variant="primary" onClick={() => void createModifier()} disabled={busy}>Add modifier</SmallButton>
            </div>
          </div>

          <div className="space-y-5">
            {bucketModifiersByCategory(modifiers).map(([bucketName, bucketModifiers]) => (
              <div key={bucketName}>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{bucketName}</h4>
                  <span className="text-xs text-dash-tertiary">{bucketModifiers.length}</span>
                </div>
                <div className="space-y-2">
                  {bucketModifiers.map(modifier => (
                    <ModifierRow
                      key={modifier.id}
                      modifier={modifier}
                      menuItems={mergedItems}
                      busy={busy}
                      onRename={next => void updateModifier(modifier.id, { name: next })}
                      onReprice={next => void updateModifier(modifier.id, { price_delta: next })}
                      onRecategorize={next => void updateModifier(modifier.id, { group_name: next })}
                      onReplaceItems={itemIds => void replaceModifierItems(modifier.id, itemIds)}
                      onDelete={() => void deleteModifier(modifier.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {modifiers.length === 0 && (
              <MenuEmptyState title="No modifiers yet">
                Add choices guests make — sides, temps, sauces, add-ons — and attach them to items.
              </MenuEmptyState>
            )}
          </div>
        </SectionShell>
      )}

      {!loading && activeTab === 'groups' && (
        <SectionShell
          title="Modifier Groups"
          description='Questions the POS asks when an item is ordered — "Choose a side", "Pick a dressing". A question can be shared by many items; edit it once, it updates everywhere. Any answer can trigger a follow-up question, nested as deep as you need.'
        >
          <div className="mb-5 space-y-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
            <div className="grid gap-3 md:grid-cols-[1.6fr_auto_auto]">
              <TextInput value={groupDraft.name} onChange={event => setGroupDraft(prev => ({ ...prev, name: event.target.value }))} placeholder='Question guests are asked, e.g. "Choose a side"' />
              <SmallButton
                variant={groupDraft.is_required ? 'primary' : 'secondary'}
                onClick={() => setGroupDraft(prev => ({ ...prev, is_required: !prev.is_required }))}
              >
                {groupDraft.is_required ? 'Required' : 'Optional'}
              </SmallButton>
              <SmallButton variant="primary" onClick={() => void createGroup()} disabled={busy}>Create question</SmallButton>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-dash-secondary">
              <span>Guest picks at least</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={groupDraft.min_selections} onChange={event => setGroupDraft(prev => ({ ...prev, min_selections: cleanDigits(event.target.value) }))} />
              <span>and at most</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" placeholder="∞" value={groupDraft.max_selections} onChange={event => setGroupDraft(prev => ({ ...prev, max_selections: cleanDigits(event.target.value) }))} />
              <span className="text-dash-tertiary">·</span>
              <span>first</span>
              <TextInput inputMode="numeric" className="!w-16 !px-2 !py-1.5 text-center" value={groupDraft.included_count} onChange={event => setGroupDraft(prev => ({ ...prev, included_count: cleanDigits(event.target.value) }))} />
              <span>selections are free, then $</span>
              <TextInput inputMode="decimal" className="!w-20 !px-2 !py-1.5 text-center" placeholder="0.00" value={groupDraft.overage_price} onChange={event => setGroupDraft(prev => ({ ...prev, overage_price: cleanDecimal(event.target.value) }))} />
              <span>each extra</span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-gold/80">
              {groupRulesSummary({
                is_required: groupDraft.is_required,
                min_selections: groupDraft.min_selections,
                max_selections: groupDraft.max_selections === '' ? null : groupDraft.max_selections,
                included_count: groupDraft.included_count,
                overage_price: groupDraft.overage_price === '' ? null : groupDraft.overage_price,
              })}
            </p>
          </div>

          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-mono">Nested readiness</p>
                <p className="mt-1 text-sm text-dash-secondary">Follow-up questions that POS will show after an option is selected.</p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-dash-secondary">
                {nestedReadiness.edgeCount} nested link{nestedReadiness.edgeCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ['Empty child groups', nestedReadiness.emptyChildren, 'Add options before using this follow-up.'],
                ['Required follow-ups', nestedReadiness.requiredChildren, 'Blocks add only after parent option is selected.'],
                ['Shared questions', nestedReadiness.sharedChildren, 'Edits affect every item/path using this question.'],
                ['Nested chains', nestedReadiness.chains, 'Option opens a question that opens another question.'],
              ].map(([label, rows, hint]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-dash-secondary">{label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${rows.length ? 'bg-dash-gold/15 text-dash-gold' : 'bg-emerald-400/10 text-emerald-300'}`}>{rows.length}</span>
                  </div>
                  <p className="mt-1 text-xs text-dash-tertiary">{hint}</p>
                  {rows.slice(0, 3).map(edge => (
                    <p key={`${edge.group.id}:${edge.option.modifier_id}:${edge.option.child_group_id}`} className="mt-2 truncate text-xs text-dash-primary">
                      {edge.group.name} -> {edge.child?.name || 'Missing question'}
                    </p>
                  ))}
                  {rows.length > 3 && <p className="mt-2 text-xs text-dash-tertiary">+{rows.length - 3} more</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                groups={groups}
                modifiers={modifiers}
                menuItems={mergedItems}
                busy={busy}
                onSave={saveGroup}
                onArchive={archiveGroup}
                onLink={runGroupLink}
                onAddModifiers={ids => void addModifiersToGroup(group, ids)}
                onCreateModifier={draft => void createModifierIntoGroup(group, draft)}
              />
            ))}
            {groups.length === 0 && (
              <MenuEmptyState title="No modifier groups yet">
                Create a question above, add modifier options to it, and attach it to items — or build questions directly inside an item's editor.
              </MenuEmptyState>
            )}
          </div>
        </SectionShell>
      )}

      {!loading && activeTab === 'specials' && (
        <div className="space-y-5">
          <SectionShell
            title="Specials"
            description="Overlay a special name, price, and note on a real menu item — the base item keeps its tax, modifiers, and routing. Schedule weekly, by date window, on an N-day cycle, or pin manually."
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-3">
                <p className="label-mono">Current specials</p>
                {specials.length === 0 && (
                  <MenuEmptyState title="No specials yet">
                    Pin today's special or build a schedule on the right.
                  </MenuEmptyState>
                )}
                {specials.map(special => {
                  const baseItem = mergedItems.find(item => item.id === special.menu_item_id)
                  const isLive = activeSpecials.includes(special)
                  return (
                    <div key={special.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isLive ? 'bg-amber-200 text-amber-900' : 'bg-white/10 text-dash-tertiary'}`}>
                              {isLive ? 'Live' : 'Scheduled'}
                            </span>
                            <h4 className="font-semibold">{special.display_name || baseItem?.name || 'Daily special'}</h4>
                          </div>
                          <p className="mt-1 text-sm text-dash-secondary">
                            {baseItem?.name || 'Base item'} · {special.schedule_kind === 'weekly'
                              ? `Weekly: ${(special.days_of_week || []).map(day => DAYS_SHORT[day]).join(', ')}`
                              : special.schedule_kind === 'date_window'
                                ? `${special.start_date || '...'} → ${special.end_date || '...'}`
                                : special.schedule_kind === 'cycle'
                                  ? `Every ${special.cycle_length_days} days`
                                  : 'Manual'}
                            {special.start_time ? ` · ${String(special.start_time).slice(0, 5)}${special.end_time ? `–${String(special.end_time).slice(0, 5)}` : ''}` : ''}
                          </p>
                          {special.note && <p className="mt-1 text-sm text-dash-tertiary">{special.note}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-lg font-semibold">{special.special_price != null ? money(special.special_price) : money(baseItem?.price)}</div>
                          <div className="flex gap-2">
                            <SmallButton variant={special.is_active ? 'primary' : 'secondary'} onClick={() => void updateSpecial(special, { is_active: !special.is_active })}>
                              {special.is_active ? 'Active' : 'Paused'}
                            </SmallButton>
                            <SmallButton variant="danger" onClick={() => void archiveSpecial(special)}>Archive</SmallButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="label-mono">New special</p>
                <div className="mt-3 space-y-3">
                  <Field label="Base menu item">
                    <SelectInput
                      value={specialDraft.menu_item_id}
                      onChange={event => {
                        const item = mergedItems.find(row => row.id === event.target.value)
                        setSpecialDraft(prev => ({
                          ...prev,
                          menu_item_id: event.target.value,
                          display_name: prev.display_name || item?.name || '',
                          special_price: prev.special_price || (item?.price != null ? String(item.price) : ''),
                        }))
                      }}
                    >
                      <option value="">Choose item...</option>
                      {mergedItems.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
                    </SelectInput>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Special name">
                      <TextInput value={specialDraft.display_name} onChange={event => setSpecialDraft(prev => ({ ...prev, display_name: event.target.value }))} placeholder="Tuesday Burger" />
                    </Field>
                    <Field label="Special price">
                      <TextInput inputMode="decimal" value={specialDraft.special_price} onChange={event => setSpecialDraft(prev => ({ ...prev, special_price: cleanDecimal(event.target.value) }))} placeholder="12.00" />
                    </Field>
                  </div>
                  <Field label="Note">
                    <TextInput value={specialDraft.note} onChange={event => setSpecialDraft(prev => ({ ...prev, note: event.target.value }))} placeholder="Blackened mahi, lemon slaw" />
                  </Field>
                  <Field label="Schedule">
                    <SelectInput value={specialDraft.schedule_kind} onChange={event => setSpecialDraft(prev => ({ ...prev, schedule_kind: event.target.value }))}>
                      <option value="manual">Manual (pin now, unpin when done)</option>
                      <option value="weekly">Weekly on chosen days</option>
                      <option value="date_window">Date window</option>
                      <option value="cycle">N-day cycle</option>
                    </SelectInput>
                  </Field>
                  {specialDraft.schedule_kind === 'weekly' && (
                    <div className="flex flex-wrap gap-2">
                      {DAYS_SHORT.map((day, index) => (
                        <SmallButton
                          key={day}
                          variant={specialDraft.days_of_week.includes(index) ? 'primary' : 'secondary'}
                          onClick={() => setSpecialDraft(prev => ({
                            ...prev,
                            days_of_week: prev.days_of_week.includes(index)
                              ? prev.days_of_week.filter(value => value !== index)
                              : [...prev.days_of_week, index].sort(),
                          }))}
                        >
                          {day}
                        </SmallButton>
                      ))}
                    </div>
                  )}
                  {specialDraft.schedule_kind === 'date_window' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Start date"><TextInput type="date" value={specialDraft.start_date} onChange={event => setSpecialDraft(prev => ({ ...prev, start_date: event.target.value }))} /></Field>
                      <Field label="End date"><TextInput type="date" value={specialDraft.end_date} onChange={event => setSpecialDraft(prev => ({ ...prev, end_date: event.target.value }))} /></Field>
                    </div>
                  )}
                  {specialDraft.schedule_kind === 'cycle' && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Anchor date"><TextInput type="date" value={specialDraft.cycle_anchor_date} onChange={event => setSpecialDraft(prev => ({ ...prev, cycle_anchor_date: event.target.value }))} /></Field>
                      <Field label="Cycle days"><TextInput inputMode="numeric" value={specialDraft.cycle_length_days} onChange={event => setSpecialDraft(prev => ({ ...prev, cycle_length_days: cleanDigits(event.target.value) }))} /></Field>
                      <Field label="Special day"><TextInput inputMode="numeric" value={specialDraft.cycle_day_number} onChange={event => setSpecialDraft(prev => ({ ...prev, cycle_day_number: cleanDigits(event.target.value) }))} /></Field>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Start time"><TextInput type="time" value={specialDraft.start_time} onChange={event => setSpecialDraft(prev => ({ ...prev, start_time: event.target.value }))} /></Field>
                    <Field label="End time"><TextInput type="time" value={specialDraft.end_time} onChange={event => setSpecialDraft(prev => ({ ...prev, end_time: event.target.value }))} /></Field>
                  </div>
                  <Field label="Expires (optional)">
                    <TextInput type="datetime-local" value={specialDraft.expires_at} onChange={event => setSpecialDraft(prev => ({ ...prev, expires_at: event.target.value }))} />
                  </Field>
                  <SmallButton variant="primary" onClick={() => void createSpecial()} disabled={busy}>Save special</SmallButton>
                </div>
              </div>
            </div>
          </SectionShell>

          <SectionShell
            title="Item Availability Schedule"
            description="Limit when regular items appear on the POS — brunch-only dishes, seasonal plates, late-night menus. Full editor lives inside each item."
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-2">
                <p className="label-mono">Items with schedules</p>
                {scheduledItems.length === 0 && (
                  <MenuEmptyState title="Everything is always available">
                    Open an item (or pick one on the right) to give it a weekly or seasonal window.
                  </MenuEmptyState>
                )}
                {scheduledItems.map(item => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm">
                    <div>
                      <span className="font-medium text-dash-cream">{item.name}</span>
                      <span className="ml-2 text-dash-tertiary">
                        {item.availability_mode === 'schedule'
                          ? `Weekly: ${(item.availability_days || []).map(day => DAYS_SHORT[day]).join(', ')}${item.availability_start_time ? ` · ${String(item.availability_start_time).slice(0, 5)}–${item.availability_end_time ? String(item.availability_end_time).slice(0, 5) : 'close'}` : ''}`
                          : item.availability_mode === 'seasonal'
                            ? `${item.availability_start_date || '...'} → ${item.availability_end_date || '...'}`
                            : 'Manual only'}
                      </span>
                    </div>
                    <SmallButton onClick={() => { setActiveTab('items'); setSelectedItemId(item.id) }}>Edit item</SmallButton>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="label-mono">Jump to an item</p>
                <div className="mt-3 space-y-3">
                  <SelectInput value={scheduleItemId} onChange={event => setScheduleItemId(event.target.value)}>
                    <option value="">Choose item...</option>
                    {mergedItems.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
                  </SelectInput>
                  <SmallButton
                    variant="primary"
                    disabled={!scheduleItemId}
                    onClick={() => {
                      setActiveTab('items')
                      setSelectedItemId(scheduleItemId)
                    }}
                  >
                    Open availability editor
                  </SmallButton>
                </div>
              </div>
            </div>
          </SectionShell>
        </div>
      )}

      {!loading && activeTab === 'printing' && (
        <div className="space-y-5">
          <SectionShell
            title="Stations & Printers"
            description="Stations are logical prep areas (Grill, Fry, Bar); printers and KDS screens are the physical targets attached to them."
          >
            {routing?.fallback && (
              <div className={`mb-4 rounded-xl border p-3 text-sm ${routing.fallback.ok ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-red-400/20 bg-red-400/10 text-red-200'}`}>
                {routing.fallback.ok ? 'Fallback station is ready — kitchen send is unblocked.' : routing.fallback.reason || 'Configure a fallback station with an active printer to unblock kitchen send.'}
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <StationsEditor stations={stations} busy={busy} onCreate={createStation} />
              <TargetsEditor targets={routing?.targets || []} stations={stations} busy={busy} onCreate={createTarget} onAssign={assignTarget} />
            </div>
          </SectionShell>

          <SectionShell
            title="Category Printing Defaults"
            description="Send whole categories to a station — every item follows its category unless it has its own override below."
          >
            <div className="space-y-2">
              {categoryNames.map(name => {
                const category = categoriesByName[name]
                return (
                  <div key={name} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 lg:grid-cols-[1fr_1fr] lg:items-center">
                    <span className="flex items-center gap-2 text-sm font-medium text-dash-cream">
                      {category?.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />}
                      {name}
                    </span>
                    <SelectInput
                      value={category?.routing_station_id || ''}
                      onChange={event => event.target.value && void routeCategory(name, event.target.value)}
                    >
                      <option value="">No station assigned</option>
                      {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                    </SelectInput>
                  </div>
                )
              })}
              {categoryNames.length === 0 && (
                <MenuEmptyState title="No categories yet">
                  Create categories first, then route them to stations here.
                </MenuEmptyState>
              )}
            </div>
          </SectionShell>

          <SectionShell
            title="Item Overrides"
            description="Route individual items somewhere different from their category — e.g. the seafood tower to the raw bar printer."
          >
            <div className="mb-3">
              <TextInput value={routingItemSearch} onChange={event => setRoutingItemSearch(event.target.value)} placeholder="Search items..." />
            </div>
            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {routingItems.map(item => {
                const categoryDefault = categoriesByName[item.category || '']?.routing_station_id || ''
                const effective = item.routing_station_id || categoryDefault
                return (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 lg:grid-cols-[1.4fr_1fr_1fr] lg:items-center">
                    <div className="text-sm">
                      <span className="font-medium text-dash-cream">{item.name}</span>
                      <span className="ml-2 text-xs text-dash-tertiary">{item.category}</span>
                    </div>
                    <span className="text-sm text-dash-tertiary">
                      {item.routing_station_id
                        ? `Override → ${stationsById[item.routing_station_id]?.name || 'Station'}`
                        : effective
                          ? `Inherits ${stationsById[effective]?.name || 'category station'}`
                          : 'No station'}
                    </span>
                    <SelectInput
                      value={item.routing_station_id || ''}
                      onChange={event => void patchItem(item.id, { routing_station_id: event.target.value || null }, event.target.value ? 'Item override saved.' : 'Item now inherits its category station.')}
                    >
                      <option value="">Inherit from category</option>
                      {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
                    </SelectInput>
                  </div>
                )
              })}
            </div>
          </SectionShell>
        </div>
      )}
    </div>
  )
}

// ── Modifier list row ───────────────────────────────────────────────────────

function NewTaxRateInline({ busy, onCreate }) {
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const rateNumber = rate === '' ? null : Number(rate)

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
      <span className="label-mono">New tax rate</span>
      <div className="w-48">
        <TextInput value={name} onChange={event => setName(event.target.value)} placeholder="Liquor tax" className="!py-2" />
      </div>
      <div className="w-24">
        <TextInput inputMode="decimal" value={rate} onChange={event => setRate(cleanDecimal(event.target.value))} placeholder="15" className="!py-2" />
      </div>
      <span className="text-sm text-dash-secondary">%</span>
      <SmallButton
        variant="primary"
        disabled={!name.trim() || rateNumber == null || rateNumber > 100 || busy}
        onClick={() => {
          onCreate(name.trim(), rateNumber)
          setName('')
          setRate('')
        }}
      >
        Create rate
      </SmallButton>
      <span className="text-xs text-dash-tertiary">e.g. state liquor at 15% — then assign it to a category below.</span>
    </div>
  )
}

function ModifierRow({ modifier, menuItems, busy, onRename, onReprice, onRecategorize, onReplaceItems, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const selectedIds = useMemo(() => new Set(modifier.item_ids || []), [modifier])

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="grid gap-3 lg:grid-cols-[1.3fr_120px_160px_auto_auto_auto] lg:items-center">
        <TextInput
          defaultValue={modifier.name}
          onBlur={event => {
            const next = event.target.value.trim()
            if (next && next !== modifier.name) onRename(next)
          }}
        />
        <TextInput
          inputMode="decimal"
          defaultValue={modifier.price_delta != null ? String(modifier.price_delta) : '0'}
          onBlur={event => {
            const next = Number(cleanDecimal(event.target.value)) || 0
            if (next !== Number(modifier.price_delta)) onReprice(next)
          }}
        />
        <TextInput
          list="menu-modifier-categories"
          title="Category — type a new name to create one"
          defaultValue={modifierCategoryOf(modifier)}
          onBlur={event => {
            const next = event.target.value.trim() || 'Add-ons'
            if (next !== modifierCategoryOf(modifier)) onRecategorize(next)
          }}
        />
        <span className="text-sm text-dash-tertiary">{(modifier.item_ids || []).length} item{(modifier.item_ids || []).length === 1 ? '' : 's'}</span>
        <SmallButton onClick={() => setExpanded(current => !current)}>{expanded ? 'Close' : 'Items'}</SmallButton>
        <SmallButton variant="danger" onClick={onDelete} disabled={busy}>Remove</SmallButton>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <ItemChecklist
            menuItems={menuItems}
            selectedIds={selectedIds}
            onToggle={itemId => {
              const next = selectedIds.has(itemId)
                ? (modifier.item_ids || []).filter(id => id !== itemId)
                : [...(modifier.item_ids || []), itemId]
              onReplaceItems(next)
            }}
          />
        </div>
      )}
    </div>
  )
}

// ── Printing sub-editors ────────────────────────────────────────────────────

function StationsEditor({ stations, busy, onCreate }) {
  const [name, setName] = useState('')
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <h4 className="text-sm font-semibold">Stations</h4>
      <div className="mt-3 flex gap-2">
        <TextInput value={name} onChange={event => setName(event.target.value)} placeholder="Grill, Fry, Bar, Expo" />
        <SmallButton
          variant="primary"
          disabled={!name.trim() || busy}
          onClick={() => {
            onCreate(name.trim())
            setName('')
          }}
        >
          Add
        </SmallButton>
      </div>
      <div className="mt-4 space-y-2">
        {stations.map(station => (
          <div key={station.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
            <span>{station.name}</span>
            {station.is_fallback && <span className="rounded-full bg-dash-gold/15 px-2 py-0.5 text-[11px] font-semibold text-dash-gold">Fallback</span>}
          </div>
        ))}
        {stations.length === 0 && <p className="text-sm text-dash-tertiary">No stations yet — add Grill, Fry, Bar...</p>}
      </div>
    </section>
  )
}

function TargetsEditor({ targets, stations, busy, onCreate, onAssign }) {
  const [name, setName] = useState('Kitchen Printer')
  const [host, setHost] = useState('')
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <h4 className="text-sm font-semibold">Printers & Displays</h4>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <TextInput value={name} onChange={event => setName(event.target.value)} placeholder="Printer name" />
        <TextInput value={host} onChange={event => setHost(event.target.value)} placeholder="Host/IP (blank = test)" />
        <SmallButton
          variant="primary"
          disabled={busy}
          onClick={() => {
            onCreate(name.trim(), host.trim())
            setHost('')
          }}
        >
          Add
        </SmallButton>
      </div>
      <div className="mt-4 space-y-2">
        {targets.map(target => (
          <div key={target.id} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
            <span>{target.name} · {target.connection_type}</span>
            <SelectInput defaultValue="" onChange={event => event.target.value && onAssign(event.target.value, target.id)}>
              <option value="">Attach to station...</option>
              {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
            </SelectInput>
          </div>
        ))}
        {targets.length === 0 && <p className="text-sm text-dash-tertiary">No printers yet — add one, then attach it to a station.</p>}
      </div>
    </section>
  )
}

export default MenuPanel
