import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Palette, RefreshCw, Trash2 } from 'lucide-react'
import { defaultUiTheme, effectiveUiTheme, groupUiThemeTokens } from '@shire/db'
import { applyUiTheme, deleteUiThemeHistoryColor, fetchUiThemes } from './data/uiThemes'
import { buildGroupCards, UNGROUPED_ID } from './data/resellerPortfolio'
import UiAppPreview from './UiAppPreview'

const SERVICE_LABELS = { pos: 'POS', host: 'Host' }

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

function ScopePicker({ restaurants, groups, initialRestaurantIds, onCancel, onApply }) {
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-dash-border bg-dash-base shadow-2xl">
        <header className="border-b border-dash-border p-5">
          <p className="label-mono">UI scope</p>
          <h2 className="mt-1 text-2xl font-semibold">Choose what you want to view</h2>
          <p className="mt-2 text-sm text-dash-secondary">The editor loads the effective theme for these restaurants. Saving applies back to the same selection.</p>
          <div className="mt-5 inline-flex rounded-lg border border-dash-border p-1">
            {['restaurants', 'groups'].map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}>{item}</button>)}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5">
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
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dash-border p-5"><p className="text-sm text-dash-secondary">{targetIds.length} restaurant{targetIds.length === 1 ? '' : 's'} selected</p><div className="flex gap-2">{onCancel && <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-dash-border px-4 text-sm font-semibold">Cancel</button>}<button type="button" disabled={targetIds.length === 0} onClick={() => onApply(targetIds)} className="h-10 rounded-lg bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40">View selection</button></div></footer>
      </div>
    </div>
  )
}

export default function ResellerUiEditor({ restaurants, groups, initialRestaurantId }) {
  const [selectedIds, setSelectedIds] = useState([])
  const [pickerOpen, setPickerOpen] = useState(true)
  const [service, setService] = useState('pos')
  const [data, setData] = useState(null)
  const [drafts, setDrafts] = useState({ pos: defaultUiTheme('pos'), host: defaultUiTheme('host') })
  const [mixed, setMixed] = useState({ pos: false, host: false })
  const [activeToken, setActiveToken] = useState(null)
  const [dirty, setDirty] = useState({ pos: false, host: false })
  const [status, setStatus] = useState({ tone: '', text: '' })
  const [loading, setLoading] = useState(false)

  const load = async (ids) => {
    setLoading(true)
    setStatus({ tone: '', text: '' })
    try {
      const response = await fetchUiThemes(ids)
      const nextDrafts = {}
      const nextMixed = {}
      for (const targetService of ['pos', 'host']) {
        const effective = ids.map((restaurantId) => {
          const row = response.themes.find((item) => item.restaurant_id === restaurantId && item.service === targetService)
          return effectiveUiTheme(targetService, row?.tokens)
        })
        const consistent = effective.length > 0 && effective.every((item) => sameTheme(effective[0], item))
        nextDrafts[targetService] = consistent ? effective[0] : defaultUiTheme(targetService)
        nextMixed[targetService] = !consistent
      }
      setSelectedIds(ids)
      setData(response)
      setDrafts(nextDrafts)
      setMixed(nextMixed)
      setDirty({ pos: false, host: false })
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

  const updateColor = (key, value) => {
    setActiveToken(key)
    setDrafts((current) => ({ ...current, [service]: { ...current[service], [key]: value } }))
    setDirty((current) => ({ ...current, [service]: true }))
  }

  const save = async () => {
    setLoading(true)
    setStatus({ tone: '', text: '' })
    try {
      await applyUiTheme(service, selectedIds, drafts[service])
      await load(selectedIds)
      setStatus({ tone: 'success', text: `${SERVICE_LABELS[service]} theme applied to ${selectedIds.length} restaurant${selectedIds.length === 1 ? '' : 's'}.` })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not apply theme.' })
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

  return <>
    {pickerOpen && <ScopePicker restaurants={restaurants} groups={groups} initialRestaurantIds={selectedIds.length ? selectedIds : [initialRestaurantId].filter(Boolean)} onCancel={selectedIds.length ? () => setPickerOpen(false) : null} onApply={(ids) => void load(ids)} />}
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="label-mono">Reseller UI editor</p><h1 className="mt-1 text-2xl font-semibold">Application colors</h1><p className="mt-2 max-w-2xl text-sm text-dash-secondary">Edit the runtime theme delivered to each selected restaurant's POS and Host applications.</p></div>
        <button type="button" onClick={() => setPickerOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dash-border px-4 text-sm font-semibold"><RefreshCw size={15} />Change selection</button>
      </header>
      <div className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Viewing</span>{selectedNames.slice(0, 4).map((name) => <span key={name} className="rounded-full border border-dash-border px-3 py-1 text-xs text-dash-secondary">{name}</span>)}{selectedNames.length > 4 && <span className="text-xs text-dash-tertiary">+{selectedNames.length - 4} more</span>}</div></div>
      {status.text && <div className={`rounded-lg border p-3 text-sm ${status.tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{status.text}</div>}
      <div className="flex rounded-lg border border-dash-border p-1">{['pos', 'host'].map((item) => <button key={item} type="button" onClick={() => setService(item)} className={`flex-1 rounded-md py-2.5 text-sm font-semibold ${service === item ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}>{SERVICE_LABELS[item]}</button>)}</div>
      {mixed[service] && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">The selected restaurants have different {SERVICE_LABELS[service]} themes. The editor is showing the service default; saving will make the complete scheme consistent across this selection.</div>}
      <section className="space-y-5">
        <div className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Real application sandbox</h2><p className="mt-1 text-xs text-dash-tertiary">Uses the service's actual screens and components with isolated in-memory data.</p></div><span className="label-mono">{SERVICE_LABELS[service]}</span></div>
          <UiAppPreview service={service} colors={colors} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {groupUiThemeTokens(service).map(({ group, tokens }) => <div key={group} className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4"><h2 className="text-sm font-semibold">{group}</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{tokens.map((item) => <label key={item.key} onClick={() => setActiveToken(item.key)} className={`grid grid-cols-[42px_1fr] items-center gap-3 rounded-lg border p-3 ${activeToken === item.key ? 'border-shell-accent' : 'border-dash-border'}`}><input type="color" aria-label={`Choose ${item.label}`} value={pickerHex(colors[item.key])} onChange={(event) => updateColor(item.key, event.target.value)} className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0" /><span className="min-w-0"><span className="block text-xs font-semibold">{item.label}</span><input aria-label={`${item.label} color code`} value={colors[item.key]} onChange={(event) => updateColor(item.key, event.target.value)} className="mt-1 w-full bg-transparent font-mono text-xs text-dash-secondary outline-none" /></span></label>)}</div></div>)}
        </div>
        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent colors</h2><p className="mt-1 text-xs text-dash-tertiary">Select a color to apply it to the active field. Right-click to remove it.</p></div><Palette size={18} className="text-dash-tertiary" /></div>{history.length ? <div className="mt-4 flex flex-wrap gap-2">{history.map((item) => <div key={item.color} className="group relative"><button type="button" title={item.color} onClick={() => activeToken && updateColor(activeToken, item.color)} onContextMenu={(event) => { event.preventDefault(); void deleteHistory(item.color) }} className="h-10 w-10 rounded-md border border-dash-border" style={{ background: item.color }} /><button type="button" aria-label={`Delete ${item.color}`} onClick={() => void deleteHistory(item.color)} className="absolute -right-1 -top-1 hidden h-5 w-5 place-items-center rounded-full bg-red-600 text-white group-hover:grid"><Trash2 size={11} /></button></div>)}</div> : <p className="mt-4 text-sm text-dash-tertiary">Saved colors appear after the first theme is applied.</p>}</div>
          <button type="button" disabled={loading || !dirty[service]} onClick={() => void save()} className="w-full rounded-lg bg-shell-cta py-3 text-sm font-semibold text-shell-cta-text disabled:opacity-40">{loading ? 'Saving…' : `Apply ${SERVICE_LABELS[service]} theme`}</button>
        </aside>
        </div>
      </section>
    </div>
  </>
}
