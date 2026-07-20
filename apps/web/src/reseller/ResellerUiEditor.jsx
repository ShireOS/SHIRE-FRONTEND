import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, Palette, Pencil, RefreshCw, Search, Trash2, X, Zap } from 'lucide-react'
import { defaultUiTheme, effectiveUiTheme, groupUiThemeTokens } from '@shire/db'
import { applyUiTheme, deleteUiThemeHistoryColor, fetchUiThemes } from './data/uiThemes'
import { applyPosQuickMenu, fetchPosQuickMenu } from './data/quickMenu'
import { buildGroupCards, UNGROUPED_ID } from './data/resellerPortfolio'
import UiAppPreview from './UiAppPreview'
import { PublishControls } from '../shared/components/PublishControls'
import MenuWorkspaceEditor from '../shared/components/MenuWorkspaceEditor'
import { scheduleChange } from '../shared/api/scheduledChanges'

const SERVICE_LABELS = { pos: 'POS', host: 'Host' }
const QUICK_MENU_LIMIT = 6

function resolvedQuickMenu(draft) {
  if (!draft) return null
  const configured = draft.mode === 'custom'
    ? draft.configured_item_ids
    : draft.items.filter((item) => item.is_available).slice(0, QUICK_MENU_LIMIT).map((item) => item.id)
  const available = new Set(draft.items.filter((item) => item.is_available).map((item) => item.id))
  return { ...draft, resolved_item_ids: configured.filter((id) => available.has(id)).slice(0, QUICK_MENU_LIMIT) }
}

function QuickMenuEditor({ restaurants, restaurantId, onRestaurantChange, draft, loading, onChange }) {
  const [search, setSearch] = useState('')
  const selectedIds = draft?.configured_item_ids || []
  const itemById = new Map((draft?.items || []).map((item) => [item.id, item]))
  const visibleItems = (draft?.items || []).filter((item) => {
    const query = search.trim().toLowerCase()
    return !query || `${item.name} ${item.category}`.toLowerCase().includes(query)
  })
  const update = (patch) => onChange(resolvedQuickMenu({ ...draft, ...patch }))
  const setMode = (mode) => {
    const configured = mode === 'custom' && draft.mode !== 'custom'
      ? draft.resolved_item_ids.slice(0, QUICK_MENU_LIMIT)
      : selectedIds
    update({ mode, configured_item_ids: mode === 'custom' ? configured : [] })
  }
  const toggleItem = (item) => {
    if (!item.is_available) return
    const next = selectedIds.includes(item.id)
      ? selectedIds.filter((id) => id !== item.id)
      : selectedIds.length < QUICK_MENU_LIMIT ? [...selectedIds, item.id] : selectedIds
    update({ mode: 'custom', configured_item_ids: next })
  }
  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= selectedIds.length) return
    const next = [...selectedIds]
    ;[next[index], next[target]] = [next[target], next[index]]
    update({ configured_item_ids: next })
  }

  return <aside className="min-w-0 border-t border-dash-border pt-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Quick Menu</h3><p className="mt-1 text-xs text-dash-tertiary">Top sellers fill the free space; custom picks compact to stay non-scrollable.</p></div><span className="font-mono text-xs text-dash-tertiary">{draft?.mode === 'custom' ? selectedIds.length : draft?.resolved_item_ids?.length || 0}/{QUICK_MENU_LIMIT}</span></div>
    {restaurants.length > 1 && <label className="mt-4 block text-xs font-semibold">Restaurant<select value={restaurantId} onChange={(event) => onRestaurantChange(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3 text-sm">{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>}
    {loading || !draft ? <div className="mt-5 text-sm text-dash-secondary">Loading menu...</div> : <>
      <div className="mt-4 grid grid-cols-2 rounded-lg border border-dash-border p-1">
        {[['automatic', 'Automatic'], ['custom', 'Custom']].map(([id, label]) => <button key={id} type="button" onClick={() => setMode(id)} className={`rounded-md px-3 py-2 text-xs font-semibold ${draft.mode === id ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}>{label}</button>)}
      </div>
      <p className="mt-2 text-xs text-dash-tertiary">{draft.mode === 'automatic' ? 'Ranked by units sold across completed local days in the last 90 days.' : 'Shown in this exact order; unavailable items remain configured but are hidden on the POS.'}</p>
      {draft.mode === 'custom' && <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold">Button order</p>
        {selectedIds.length ? selectedIds.map((id, index) => { const item = itemById.get(id); return <div key={id} className="flex min-h-10 items-center gap-2 border-b border-dash-border py-2"><span className="w-5 font-mono text-xs text-dash-tertiary">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{item?.name || 'Removed item'}</strong><span className="block truncate text-[11px] text-dash-tertiary">{item?.category || 'No longer on menu'}</span></span><button type="button" title="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="grid h-8 w-8 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowUp size={13} /></button><button type="button" title="Move down" disabled={index === selectedIds.length - 1} onClick={() => move(index, 1)} className="grid h-8 w-8 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowDown size={13} /></button><button type="button" title="Remove item" onClick={() => toggleItem(item || { id, is_available: true })} className="grid h-8 w-8 place-items-center rounded-md border border-dash-border"><X size={13} /></button></div> }) : <p className="text-xs text-dash-tertiary">Select up to six items below.</p>}
      </div>}
      <label className="relative mt-4 block"><span className="sr-only">Search menu items</span><Search size={14} className="pointer-events-none absolute left-3 top-3 text-dash-tertiary" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu" className="h-10 w-full rounded-md border border-dash-border bg-transparent pl-9 pr-3 text-sm outline-none" /></label>
      <div className="mt-2 max-h-[360px] overflow-y-auto border-y border-dash-border">
        {visibleItems.map((item) => { const checked = draft.mode === 'custom' ? selectedIds.includes(item.id) : draft.resolved_item_ids.includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-center gap-3 border-b border-dash-border px-1 py-3 last:border-0 ${item.is_available ? '' : 'cursor-not-allowed opacity-45'}`}><input type="checkbox" checked={checked} disabled={!item.is_available} onChange={() => toggleItem(item)} className="h-4 w-4 accent-[var(--shell-accent)]" /><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{item.name}</strong><span className="mt-0.5 block truncate text-[11px] text-dash-tertiary">#{item.popularity_rank} · {item.category} · {item.units_sold} sold</span></span><span className="font-mono text-[11px] text-dash-secondary">${Number(item.price).toFixed(2)}</span></label> })}
      </div>
    </>}
  </aside>
}

function pickerHex(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  if (/^#[0-9a-f]{8}$/i.test(value)) return value.slice(0, 7)
  const match = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!match) return '#000000'
  return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
}

function sameTheme(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key])
}

function ScopePicker({ restaurants, groups, initialRestaurantIds, onCancel, onApply, loading = false, error = '' }) {
  const cards = useMemo(() => buildGroupCards(restaurants, groups), [groups, restaurants])
  const [tab, setTab] = useState('restaurants')
  const [groupFilter, setGroupFilter] = useState('all')
  const [restaurantIds, setRestaurantIds] = useState(() => new Set(initialRestaurantIds))
  const [groupIds, setGroupIds] = useState(new Set())
  const visible = groupFilter === 'all' ? restaurants : restaurants.filter((item) => item.reseller_group_id === groupFilter)
  const targetIds = tab === 'groups'
    ? [...new Set(restaurants.filter((item) => groupIds.has(item.reseller_group_id)).map((item) => item.id))]
    : [...restaurantIds]
  const allVisible = visible.length > 0 && visible.every((item) => restaurantIds.has(item.id))

  const toggleRestaurant = (id) => setRestaurantIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleGroup = (id) => setGroupIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [loading, onCancel])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && !loading && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="ui-scope-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-dash-border bg-dash-base shadow-2xl">
        <header className="border-b border-dash-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="label-mono">UI scope</p><h2 id="ui-scope-title" className="mt-1 text-2xl font-semibold">Choose what you want to view</h2></div>
            <button type="button" onClick={onCancel} disabled={loading} aria-label="Close scope picker" className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-dash-border text-dash-secondary disabled:opacity-40"><X size={16} /></button>
          </div>
          <p className="mt-2 text-sm text-dash-secondary">The editor loads the effective theme for these restaurants. Saving applies back to the same selection.</p>
          <div className="mt-5 inline-flex rounded-lg border border-dash-border p-1">
            {['restaurants', 'groups'].map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}>{item}</button>)}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          {tab === 'restaurants' ? <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <label className="relative">
                <span className="sr-only">Filter restaurants by group</span>
                <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="h-10 appearance-none rounded-lg border border-dash-border bg-transparent pl-3 pr-9 text-sm text-dash-cream"><option value="all">All groups</option>{cards.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-dash-tertiary" />
              </label>
              <button type="button" onClick={() => setRestaurantIds((current) => { const next = new Set(current); visible.forEach((item) => allVisible ? next.delete(item.id) : next.add(item.id)); return next })} className="h-10 rounded-lg border border-dash-border px-3 text-sm font-semibold">{allVisible ? 'Unselect shown' : 'Select shown'}</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{visible.map((restaurant) => <button key={restaurant.id} type="button" onClick={() => toggleRestaurant(restaurant.id)} className={`flex items-center gap-3 rounded-lg border p-4 text-left ${restaurantIds.has(restaurant.id) ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}><span className="grid h-5 w-5 place-items-center rounded border border-dash-border">{restaurantIds.has(restaurant.id) && <Check size={14} />}</span><span className="min-w-0 flex-1"><strong className="block truncate">{restaurant.name}</strong><span className="mt-1 flex items-center gap-2 text-xs text-dash-secondary"><span className="h-2.5 w-2.5 rounded-full" style={{ background: restaurant.reseller_group_color }} />{restaurant.reseller_group_name}</span></span></button>)}</div>
          </> : <div className="grid gap-3 sm:grid-cols-2">{cards.map((group) => <button key={group.id} type="button" onClick={() => toggleGroup(group.id)} className={`flex items-center gap-3 rounded-lg border p-4 text-left ${groupIds.has(group.id) ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border'}`}><span className="h-3 w-3 rounded-full" style={{ background: group.color }} /><span className="flex-1"><strong>{group.name}</strong><span className="mt-1 block text-xs text-dash-secondary">{group.restaurant_count} restaurants</span></span>{groupIds.has(group.id) && <Check size={16} />}</button>)}</div>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dash-border p-5"><p className="text-sm text-dash-secondary">{targetIds.length} restaurant{targetIds.length === 1 ? '' : 's'} selected</p><div className="flex gap-2"><button type="button" onClick={onCancel} disabled={loading} className="h-10 rounded-lg border border-dash-border px-4 text-sm font-semibold disabled:opacity-40">Cancel</button><button type="button" disabled={targetIds.length === 0 || loading} onClick={() => onApply(targetIds)} className="h-10 rounded-lg bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40">{loading ? 'Loading…' : 'View selection'}</button></div></footer>
      </div>
    </div>
  )
}

export default function ResellerUiEditor({ restaurants, groups, initialRestaurantId, canEditMenuWorkspace = false }) {
  const [selectedIds, setSelectedIds] = useState([])
  const [pickerOpen, setPickerOpen] = useState(true)
  const [service, setService] = useState('pos')
  const [data, setData] = useState(null)
  const [drafts, setDrafts] = useState({ pos: defaultUiTheme('pos'), host: defaultUiTheme('host') })
  const [savedDrafts, setSavedDrafts] = useState({ pos: defaultUiTheme('pos'), host: defaultUiTheme('host') })
  const [previewDrafts, setPreviewDrafts] = useState({ pos: defaultUiTheme('pos'), host: defaultUiTheme('host') })
  const [componentDrafts, setComponentDrafts] = useState({ pos: {}, host: {} })
  const [savedComponents, setSavedComponents] = useState({ pos: {}, host: {} })
  const [previewComponents, setPreviewComponents] = useState({ pos: {}, host: {} })
  const [mixed, setMixed] = useState({ pos: false, host: false })
  const [activeToken, setActiveToken] = useState(null)
  const [previewMode, setPreviewMode] = useState('view')
  const [componentSelection, setComponentSelection] = useState(null)
  const [componentProperty, setComponentProperty] = useState('backgroundColor')
  const [componentColor, setComponentColor] = useState('#000000')
  const [status, setStatus] = useState({ tone: '', text: '' })
  const [loading, setLoading] = useState(false)
  const [quickRestaurantId, setQuickRestaurantId] = useState('')
  const [quickMenus, setQuickMenus] = useState({})
  const [savedQuickMenus, setSavedQuickMenus] = useState({})
  const [quickLoading, setQuickLoading] = useState(false)

  const load = async (ids) => {
    setLoading(true)
    setStatus({ tone: '', text: '' })
    try {
      const response = await fetchUiThemes(ids)
      const nextDrafts = {}
      const nextComponents = {}
      const nextMixed = {}
      for (const targetService of ['pos', 'host']) {
        const effective = ids.map((restaurantId) => {
          const row = response.themes.find((item) => item.restaurant_id === restaurantId && item.service === targetService)
          return effectiveUiTheme(targetService, row?.tokens)
        })
        const consistent = effective.length > 0 && effective.every((item) => sameTheme(effective[0], item))
        nextDrafts[targetService] = consistent ? effective[0] : defaultUiTheme(targetService)
        const componentSets = ids.map((restaurantId) => {
          const row = response.themes.find((item) => item.restaurant_id === restaurantId && item.service === targetService)
          return row?.component_overrides || {}
        })
        const componentsConsistent = componentSets.length > 0 && componentSets.every((item) => JSON.stringify(item) === JSON.stringify(componentSets[0]))
        nextComponents[targetService] = componentsConsistent ? componentSets[0] : {}
        nextMixed[targetService] = !consistent || !componentsConsistent
      }
      setSelectedIds(ids)
      setData(response)
      setDrafts(nextDrafts)
      setSavedDrafts(nextDrafts)
      setPreviewDrafts(nextDrafts)
      setComponentDrafts(nextComponents)
      setSavedComponents(nextComponents)
      setPreviewComponents(nextComponents)
      setMixed(nextMixed)
      setQuickRestaurantId(ids[0] || '')
      setQuickMenus({})
      setSavedQuickMenus({})
      setPreviewMode('view')
      setComponentSelection(null)
      setPickerOpen(false)
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load themes.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pickerOpen) return
    setActiveToken(null)
  }, [pickerOpen, service])

  useEffect(() => {
    if (service !== 'pos' && (previewMode === 'quick-menu' || previewMode === 'menu-workspace')) setPreviewMode('view')
  }, [previewMode, service])

  useEffect(() => {
    if (previewMode !== 'quick-menu' || service !== 'pos' || !quickRestaurantId || quickMenus[quickRestaurantId]) return
    let cancelled = false
    setQuickLoading(true)
    fetchPosQuickMenu(quickRestaurantId)
      .then((response) => {
        if (cancelled) return
        const normalized = resolvedQuickMenu(response)
        setQuickMenus((current) => ({ ...current, [quickRestaurantId]: normalized }))
        setSavedQuickMenus((current) => ({ ...current, [quickRestaurantId]: normalized }))
      })
      .catch((error) => {
        if (!cancelled) setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load Quick Menu.' })
      })
      .finally(() => { if (!cancelled) setQuickLoading(false) })
    return () => { cancelled = true }
  }, [previewMode, quickMenus, quickRestaurantId, service])

  const updateColor = (key, value) => {
    setActiveToken(key)
    setDrafts((current) => ({ ...current, [service]: { ...current[service], [key]: value } }))
  }

  const previewChanges = () => {
    setPreviewDrafts((current) => ({ ...current, [service]: { ...drafts[service] } }))
    setPreviewComponents((current) => ({ ...current, [service]: structuredClone(componentDrafts[service]) }))
    setStatus({ tone: 'success', text: `${SERVICE_LABELS[service]} draft is now shown in the sandbox. Nothing has been pushed.` })
  }

  const selectComponent = (selection) => {
    const property = selection.properties.find((item) => item.property === 'backgroundColor') || selection.properties[0]
    if (!property) return
    setComponentSelection(selection)
    setComponentProperty(property.property)
    setComponentColor(property.value)
  }

  const saveComponentColor = (scope) => {
    const property = componentSelection?.properties.find((item) => item.property === componentProperty)
    if (!componentSelection || !property) return
    if (scope === 'theme') {
      if (!property.tokenKey) return
      const nextTheme = { ...drafts[service], [property.tokenKey]: componentColor }
      setDrafts((current) => ({ ...current, [service]: nextTheme }))
      setPreviewDrafts((current) => ({ ...current, [service]: nextTheme }))
    } else {
      if (!componentSelection.registered) return
      const nextOverrides = {
        ...componentDrafts[service],
        [componentSelection.componentId]: {
          ...(componentDrafts[service][componentSelection.componentId] || {}),
          [componentProperty]: componentColor,
        },
      }
      setComponentDrafts((current) => ({ ...current, [service]: nextOverrides }))
      setPreviewComponents((current) => ({ ...current, [service]: nextOverrides }))
    }
    setComponentSelection(null)
    setStatus({ tone: 'success', text: `${componentSelection.label} updated in the sandbox. Push to iPads when it looks right.` })
  }

  const removeComponentOverride = () => {
    if (!componentSelection?.registered) return
    const serviceOverrides = structuredClone(componentDrafts[service])
    if (!serviceOverrides[componentSelection.componentId]) return
    delete serviceOverrides[componentSelection.componentId][componentProperty]
    if (!Object.keys(serviceOverrides[componentSelection.componentId]).length) delete serviceOverrides[componentSelection.componentId]
    setComponentDrafts((current) => ({ ...current, [service]: serviceOverrides }))
    setPreviewComponents((current) => ({ ...current, [service]: serviceOverrides }))
    setComponentSelection(null)
    setStatus({ tone: 'success', text: `${componentSelection.label} now inherits its theme color in the sandbox.` })
  }

  const pushToIpads = async (publication) => {
    setLoading(true)
    setStatus({ tone: '', text: '' })
    try {
      if (publication?.scheduledFor) {
        const scheduled = await scheduleChange({
          label: `${SERVICE_LABELS[service]} UI theme`,
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands: [{
            method: 'PUT',
            path: '/reseller/ui-themes',
            body: { service, restaurant_ids: selectedIds, tokens: drafts[service], component_overrides: componentDrafts[service] },
            target_type: 'reseller',
          }],
        })
        setStatus({ tone: 'success', text: `${SERVICE_LABELS[service]} UI scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.` })
        setLoading(false)
        return
      }
      await applyUiTheme(service, selectedIds, drafts[service], componentDrafts[service])
      await load(selectedIds)
      setStatus({ tone: 'success', text: `${SERVICE_LABELS[service]} UI pushed to ${selectedIds.length} restaurant${selectedIds.length === 1 ? '' : 's'}.` })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not apply theme.' })
      setLoading(false)
    }
  }

  const pushQuickMenu = async (publication) => {
    const draft = quickMenus[quickRestaurantId]
    if (!draft) return
    setLoading(true)
    setStatus({ tone: '', text: '' })
    try {
      if (publication?.scheduledFor) {
        const scheduled = await scheduleChange({
          label: 'POS Quick Menu',
          scheduledFor: publication.scheduledFor,
          timezone: publication.timezone,
          commands: [{
            method: 'PUT',
            path: '/reseller/pos-quick-menu',
            body: { restaurant_id: quickRestaurantId, mode: draft.mode, item_ids: draft.mode === 'custom' ? draft.configured_item_ids : [] },
            target_type: 'reseller',
            restaurant_id: quickRestaurantId,
          }],
        })
        setStatus({ tone: 'success', text: `Quick Menu scheduled for ${new Date(scheduled.scheduled_for).toLocaleString()}.` })
      } else {
        const saved = resolvedQuickMenu(await applyPosQuickMenu(quickRestaurantId, draft.mode, draft.configured_item_ids))
        setQuickMenus((current) => ({ ...current, [quickRestaurantId]: saved }))
        setSavedQuickMenus((current) => ({ ...current, [quickRestaurantId]: saved }))
        setStatus({ tone: 'success', text: 'Quick Menu pushed. Paired iPads will refresh within one minute.' })
      }
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not push Quick Menu.' })
    } finally {
      setLoading(false)
    }
  }

  const deleteHistory = async (color) => {
    try {
      await deleteUiThemeHistoryColor(color)
      setData((current) => ({ ...current, color_history: current.color_history.filter((item) => item.color !== color) }))
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not delete color.' })
    }
  }

  const selectedNames = restaurants.filter((item) => selectedIds.includes(item.id)).map((item) => item.name)
  const colors = drafts[service]
  const history = data?.color_history || []
  const dirty = Object.fromEntries(['pos', 'host'].map((item) => [item,
    JSON.stringify(drafts[item]) !== JSON.stringify(savedDrafts[item])
      || JSON.stringify(componentDrafts[item]) !== JSON.stringify(savedComponents[item]),
  ]))
  const previewOutdated = JSON.stringify(drafts[service]) !== JSON.stringify(previewDrafts[service])
    || JSON.stringify(componentDrafts[service]) !== JSON.stringify(previewComponents[service])
  const quickDraft = quickMenus[quickRestaurantId] || null
  const quickDirty = Boolean(quickDraft && JSON.stringify(quickDraft) !== JSON.stringify(savedQuickMenus[quickRestaurantId]))
  const anyQuickDirty = Object.entries(quickMenus).some(([restaurantId, draft]) => JSON.stringify(draft) !== JSON.stringify(savedQuickMenus[restaurantId]))
  const openPicker = () => {
    if ((Object.values(dirty).some(Boolean) || anyQuickDirty) && !window.confirm('Changing the selection will discard unpushed UI changes. Continue?')) return
    setPickerOpen(true)
  }

  return <>
    {pickerOpen && <ScopePicker restaurants={restaurants} groups={groups} initialRestaurantIds={selectedIds.length ? selectedIds : [initialRestaurantId].filter(Boolean)} onCancel={() => setPickerOpen(false)} onApply={(ids) => void load(ids)} loading={loading} error={status.tone === 'error' ? status.text : ''} />}
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="label-mono">Reseller UI editor</p><h1 className="mt-1 text-2xl font-semibold">Application colors</h1><p className="mt-2 max-w-2xl text-sm text-dash-secondary">Edit the runtime theme delivered to each selected restaurant's POS and Host applications.</p></div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={openPicker} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dash-border px-4 text-sm font-semibold"><RefreshCw size={15} />Change selection</button>
          {previewMode === 'quick-menu'
            ? quickDirty && <PublishControls label="Push to iPads" busy={loading} onPublishNow={() => pushQuickMenu()} onSchedule={(scheduledFor, timezone) => pushQuickMenu({ scheduledFor, timezone })} />
            : dirty[service] && <PublishControls label="Push to iPads" busy={loading} onPublishNow={() => pushToIpads()} onSchedule={(scheduledFor, timezone) => pushToIpads({ scheduledFor, timezone })} />}
        </div>
      </header>
      <div className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Viewing</span>{selectedNames.slice(0, 4).map((name) => <span key={name} className="rounded-full border border-dash-border px-3 py-1 text-xs text-dash-secondary">{name}</span>)}{selectedNames.length > 4 && <span className="text-xs text-dash-tertiary">+{selectedNames.length - 4} more</span>}</div></div>
      {status.text && <div className={`rounded-lg border p-3 text-sm ${status.tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{status.text}</div>}
      <div className="flex rounded-lg border border-dash-border p-1">{['pos', 'host'].map((item) => <button key={item} type="button" onClick={() => setService(item)} className={`flex-1 rounded-md py-2.5 text-sm font-semibold ${service === item ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}>{SERVICE_LABELS[item]}</button>)}</div>
      {mixed[service] && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">The selected restaurants have different {SERVICE_LABELS[service]} UI settings. The editor is showing the service default; pushing will make the complete scheme consistent across this selection.</div>}
      <section className="space-y-5">
        <div className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Real application sandbox</h2><p className="mt-1 text-xs text-dash-tertiary">Uses the service's actual screens and components with isolated in-memory data.</p></div><div className="inline-flex rounded-lg border border-dash-border p-1">{[{ id: 'view', label: 'View', icon: Eye }, { id: 'edit', label: 'Edit', icon: Pencil }, ...(service === 'pos' ? [{ id: 'menu-workspace', label: 'POS Menus', icon: Zap }] : [])].map((item) => <button key={item.id} type="button" onClick={() => setPreviewMode(item.id)} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${previewMode === item.id ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}><item.icon size={14} />{item.label}</button>)}</div></div>
          {previewMode === 'menu-workspace' ? <MenuWorkspaceEditor restaurantId={quickRestaurantId} compact canEdit={canEditMenuWorkspace} /> : previewMode === 'quick-menu' ? <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0"><UiAppPreview service="pos" tokens={previewDrafts.pos} componentOverrides={previewComponents.pos} mode="quick-menu" menuItems={quickDraft?.items} quickMenu={quickDraft} onComponentSelect={selectComponent} /></div>
            <QuickMenuEditor restaurants={restaurants.filter((item) => selectedIds.includes(item.id))} restaurantId={quickRestaurantId} onRestaurantChange={setQuickRestaurantId} draft={quickDraft} loading={quickLoading} onChange={(next) => setQuickMenus((current) => ({ ...current, [quickRestaurantId]: next }))} />
          </div> : <UiAppPreview service={service} tokens={previewDrafts[service]} componentOverrides={previewComponents[service]} mode={previewMode} onComponentSelect={selectComponent} />}
        </div>
        {previewMode !== 'quick-menu' && previewMode !== 'menu-workspace' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {groupUiThemeTokens(service).map(({ group, tokens }) => <div key={group} className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4"><h2 className="text-sm font-semibold">{group}</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{tokens.map((item) => <label key={item.key} onClick={() => setActiveToken(item.key)} className={`grid grid-cols-[42px_1fr] items-center gap-3 rounded-lg border p-3 ${activeToken === item.key ? 'border-shell-accent' : 'border-dash-border'}`}><input type="color" aria-label={`Choose ${item.label}`} value={pickerHex(colors[item.key])} onChange={(event) => updateColor(item.key, event.target.value)} className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0" /><span className="min-w-0"><span className="block text-xs font-semibold">{item.label}</span><input aria-label={`${item.label} color code`} value={colors[item.key]} onChange={(event) => updateColor(item.key, event.target.value)} className="mt-1 w-full bg-transparent font-mono text-xs text-dash-secondary outline-none" /></span></label>)}</div></div>)}
        </div>
        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent colors</h2><p className="mt-1 text-xs text-dash-tertiary">Select a color to apply it to the active field. Right-click to remove it.</p></div><Palette size={18} className="text-dash-tertiary" /></div>{history.length ? <div className="mt-4 flex flex-wrap gap-2">{history.map((item) => <div key={item.color} className="group relative"><button type="button" title={item.color} onClick={() => activeToken && updateColor(activeToken, item.color)} onContextMenu={(event) => { event.preventDefault(); void deleteHistory(item.color) }} className="h-10 w-10 rounded-md border border-dash-border" style={{ background: item.color }} /><button type="button" aria-label={`Delete ${item.color}`} onClick={() => void deleteHistory(item.color)} className="absolute -right-1 -top-1 hidden h-5 w-5 place-items-center rounded-full bg-red-600 text-white group-hover:grid"><Trash2 size={11} /></button></div>)}</div> : <p className="mt-4 text-sm text-dash-tertiary">Saved colors appear after the first theme is applied.</p>}</div>
          <button type="button" disabled={!previewOutdated} onClick={previewChanges} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-shell-cta py-3 text-sm font-semibold text-shell-cta-text disabled:opacity-40"><Eye size={15} />Preview changes</button>
        </aside>
        </div>}
      </section>
    </div>
    {componentSelection && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4" onMouseDown={(event) => event.target === event.currentTarget && setComponentSelection(null)}>
      <div className="w-full max-w-md rounded-lg border border-dash-border bg-dash-base p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="label-mono">Edit component</p><h2 className="mt-1 text-xl font-semibold">{componentSelection.label}</h2><p className="mt-1 break-all font-mono text-xs text-dash-tertiary">{componentSelection.componentId}</p></div><button type="button" title="Close" onClick={() => setComponentSelection(null)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border"><X size={16} /></button></div>
        <div className="mt-5 grid grid-cols-[48px_1fr] items-center gap-3"><input type="color" aria-label="Choose component color" value={pickerHex(componentColor)} onChange={(event) => setComponentColor(event.target.value)} className="h-11 w-11 cursor-pointer border-0 bg-transparent p-0" /><div><label className="text-xs font-semibold" htmlFor="component-color-property">Color property</label><select id="component-color-property" value={componentProperty} onChange={(event) => { const next = componentSelection.properties.find((item) => item.property === event.target.value); setComponentProperty(event.target.value); if (next) setComponentColor(next.value) }} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3 text-sm">{componentSelection.properties.map((item) => <option key={item.property} value={item.property}>{item.label}</option>)}</select></div></div>
        <input aria-label="Component color code" value={componentColor} onChange={(event) => setComponentColor(event.target.value)} className="mt-3 h-10 w-full rounded-md border border-dash-border bg-transparent px-3 font-mono text-sm outline-none" />
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" disabled={!componentSelection.registered} title={componentSelection.registered ? 'Override only this component' : 'This component has not been registered for individual overrides'} onClick={() => saveComponentColor('component')} className="rounded-lg border border-dash-border px-3 py-3 text-sm font-semibold disabled:opacity-40">Save to component</button><button type="button" disabled={!componentSelection.properties.find((item) => item.property === componentProperty)?.tokenKey} title="Update the shared theme token used by this component" onClick={() => saveComponentColor('theme')} className="rounded-lg bg-shell-cta px-3 py-3 text-sm font-semibold text-shell-cta-text disabled:opacity-40">Update theme</button></div>
        {componentSelection.registered && componentDrafts[service][componentSelection.componentId]?.[componentProperty] && <button type="button" onClick={removeComponentOverride} className="mt-3 w-full text-center text-xs font-semibold text-red-300">Remove component override</button>}
        <p className="mt-4 text-xs text-dash-tertiary">Both choices update only the sandbox draft. Use Push to iPads after reviewing the result.</p>
      </div>
    </div>}
  </>
}
