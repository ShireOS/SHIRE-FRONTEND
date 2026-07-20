import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Search, X } from 'lucide-react'
import { applyPosMenuWorkspace, fetchPosMenuWorkspace } from '../api/menuWorkspace'

const TABS = [
  ['departments', 'Departments'],
  ['server', 'Server Quick Menu'],
  ['bartender', 'Fast Bar'],
  ['homes', 'Bartender homes'],
]

const emptyProfile = (surface) => ({
  surface,
  shortcut_item_ids: [],
  browse_department_ids: [],
  default_open: null,
})

function normalizeWorkspace(value) {
  const departments = Array.isArray(value?.departments)
    ? [...value.departments].sort((a, b) => Number(a.display_order) - Number(b.display_order))
      .map((department, index) => ({ ...department, display_order: index }))
    : []
  const departmentIds = departments.map((department) => department.id)
  const rawServerDefault = value?.profiles?.server?.default_open
  const serverDefaultOpen = rawServerDefault?.kind === 'shortcuts'
    ? { kind: 'shortcuts' }
    : rawServerDefault?.kind === 'department' && departmentIds.includes(rawServerDefault.department_id)
      ? { kind: 'department', department_id: rawServerDefault.department_id }
      : departmentIds.length
        ? { kind: 'department', department_id: departmentIds[0] }
        : { kind: 'shortcuts' }
  return {
    version: Number(value?.version || 0),
    updated_at: value?.updated_at || null,
    departments,
    items: Array.isArray(value?.items) ? value.items : [],
    profiles: {
      server: { ...emptyProfile('server_menu'), ...value?.profiles?.server, browse_department_ids: departmentIds, default_open: serverDefaultOpen },
      bartender: { ...emptyProfile('fast_bar'), ...value?.profiles?.bartender, browse_department_ids: departmentIds },
    },
    restaurant_bartender_default_home: value?.restaurant_bartender_default_home === 'tabs' ? 'tabs' : 'fast_bar',
    bartenders: Array.isArray(value?.staff_options)
      ? value.staff_options.filter((staff) => staff.is_bartender).map((bartender) => ({
        ...bartender,
        id: bartender.id || bartender.waiter_id,
        home_surface: bartender.home_surface === 'fast_bar' || bartender.home_surface === 'tabs'
          ? bartender.home_surface
          : null,
      }))
      : [],
  }
}

function OrderedRows({ ids, itemById, onMove, onRemove, emptyText, disabled }) {
  if (!ids.length) return <p className="rounded-lg border border-dashed border-dash-border p-4 text-sm text-dash-tertiary">{emptyText}</p>
  return <div className="divide-y divide-dash-border rounded-lg border border-dash-border">
    {ids.map((id, index) => {
      const item = itemById.get(id)
      return <div key={id} className="flex min-h-14 items-center gap-2 px-3 py-2">
        <span className="w-6 font-mono text-xs text-dash-tertiary">{index + 1}</span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item?.name || 'Removed item'}</strong><span className="block truncate text-xs text-dash-tertiary">{item?.category || 'No longer on menu'}</span></span>
        <button type="button" aria-label={`Move ${item?.name || 'item'} up`} disabled={disabled || index === 0} onClick={() => onMove(index, -1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowUp size={14} /></button>
        <button type="button" aria-label={`Move ${item?.name || 'item'} down`} disabled={disabled || index === ids.length - 1} onClick={() => onMove(index, 1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowDown size={14} /></button>
        <button type="button" aria-label={`Remove ${item?.name || 'item'}`} disabled={disabled} onClick={() => onRemove(id)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><X size={14} /></button>
      </div>
    })}
  </div>
}

function ShortcutEditor({ title, description, profile, items, onChange, disabled }) {
  const [search, setSearch] = useState('')
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const selected = profile.shortcut_item_ids || []
  const selectedSet = new Set(selected)
  const visibleItems = items.filter((item) => {
    const query = search.trim().toLowerCase()
    return !query || `${item.name} ${item.category}`.toLowerCase().includes(query)
  })
  const updateIds = (shortcut_item_ids) => onChange({ ...profile, shortcut_item_ids })
  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= selected.length) return
    const next = [...selected]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateIds(next)
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
    <section>
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 text-sm text-dash-secondary">{description}</p></div><span className="rounded-full border border-dash-border px-3 py-1 font-mono text-xs">{selected.length} configured</span></div>
      <div className="mt-4"><OrderedRows ids={selected} itemById={itemById} onMove={move} onRemove={(id) => updateIds(selected.filter((candidate) => candidate !== id))} emptyText="No shortcuts configured. Add common items from the menu." disabled={disabled} /></div>
    </section>
    <aside>
      <label className="relative block"><span className="sr-only">Search menu items</span><Search size={15} className="pointer-events-none absolute left-3 top-3 text-dash-tertiary" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items" className="h-10 w-full rounded-md border border-dash-border bg-transparent pl-9 pr-3 text-sm outline-none" /></label>
      <div className="mt-2 max-h-[500px] overflow-y-auto rounded-lg border border-dash-border">
        {visibleItems.map((item) => <button key={item.id} type="button" disabled={disabled || item.is_available === false || selectedSet.has(item.id)} onClick={() => updateIds([...selected, item.id])} className="flex w-full items-center gap-3 border-b border-dash-border px-3 py-3 text-left last:border-0 disabled:opacity-45"><span className="grid h-5 w-5 place-items-center rounded border border-dash-border">{selectedSet.has(item.id) && <Check size={13} />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.name}</strong><span className="block truncate text-xs text-dash-tertiary">{item.category}</span></span><span className="font-mono text-xs">${Number(item.price || 0).toFixed(2)}</span></button>)}
      </div>
    </aside>
  </div>
}

export default function MenuWorkspaceEditor({ restaurantId, canEdit = true, compact = false }) {
  const [tab, setTab] = useState('departments')
  const [workspace, setWorkspace] = useState(null)
  const [saved, setSaved] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState({ tone: '', text: '' })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setStatus({ tone: '', text: '' })
    fetchPosMenuWorkspace(restaurantId)
      .then((response) => {
        if (cancelled) return
        const normalized = normalizeWorkspace(response)
        setWorkspace(normalized)
        setSaved(normalized)
      })
      .catch((error) => { if (!cancelled) setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load POS menus.' }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId])

  const dirty = Boolean(workspace && saved && JSON.stringify(workspace) !== JSON.stringify(saved))
  const updateProfile = (key, profile) => setWorkspace((current) => ({ ...current, profiles: { ...current.profiles, [key]: profile } }))
  const moveDepartment = (index, delta) => setWorkspace((current) => {
    const target = index + delta
    if (target < 0 || target >= current.departments.length) return current
    const departments = [...current.departments]
    ;[departments[index], departments[target]] = [departments[target], departments[index]]
    const rankedDepartments = departments.map((department, display_order) => ({ ...department, display_order }))
    const browse = rankedDepartments.map((department) => department.id)
    return { ...current, departments: rankedDepartments, profiles: {
      server: { ...current.profiles.server, browse_department_ids: browse },
      bartender: { ...current.profiles.bartender, browse_department_ids: browse },
    } }
  })
  const save = async () => {
    setSaving(true)
    setStatus({ tone: '', text: '' })
    try {
      const normalized = normalizeWorkspace(await applyPosMenuWorkspace(restaurantId, workspace, reason))
      setWorkspace(normalized)
      setSaved(normalized)
      setReason('')
      setStatus({ tone: 'success', text: 'POS menu workspace saved. Paired devices receive it on refresh.' })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save POS menus.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="rounded-lg border border-dash-border p-5 text-sm text-dash-secondary">Loading POS menu workspace…</div>
  if (!workspace) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{status.text || 'POS menu workspace is unavailable.'}</div>

  return <div className={compact ? 'space-y-4' : 'space-y-5'}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="label-mono">POS menus</p><h2 className="mt-1 text-2xl font-semibold">Server Menu & Fast Bar</h2><p className="mt-2 max-w-3xl text-sm text-dash-secondary">Rank departments and configure common items. Every POS always retains search and access to every department.</p></div><div className="w-full max-w-sm"><label className="block text-xs font-semibold">Change reason<input disabled={!canEdit} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this layout changing?" className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3 text-sm" /></label><button type="button" disabled={!canEdit || !dirty || !reason.trim() || saving} onClick={() => void save()} className="mt-2 h-10 w-full rounded-lg bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40">{saving ? 'Saving…' : 'Save POS menus'}</button></div></header>
    {!canEdit && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">You can view this configuration. Editing requires Menu: Edit items & modifiers.</div>}
    {status.text && <div className={`rounded-lg border p-3 text-sm ${status.tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{status.text}</div>}
    <div className="flex flex-wrap rounded-lg border border-dash-border p-1">{TABS.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`min-w-[150px] flex-1 rounded-md px-3 py-2.5 text-sm font-semibold ${tab === id ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}>{label}</button>)}</div>
    <section className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4 sm:p-5">
      {tab === 'departments' && <div><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Department rank</h3><p className="mt-1 text-sm text-dash-secondary">The POS shows five across and keeps at least two rows visible. Extra rows use this stable order when space remains.</p></div><span className="rounded-full border border-dash-border px-3 py-1 text-xs text-dash-secondary">All departments required</span></div><div className="mt-5 divide-y divide-dash-border rounded-lg border border-dash-border">{workspace.departments.map((department, index) => <div key={department.id} className="flex min-h-14 items-center gap-3 px-3 py-2"><span className="w-7 font-mono text-xs text-dash-tertiary">{index + 1}</span><strong className="min-w-0 flex-1 truncate text-sm">{department.name}</strong><button type="button" disabled={!canEdit || index === 0} onClick={() => moveDepartment(index, -1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowUp size={14} /></button><button type="button" disabled={!canEdit || index === workspace.departments.length - 1} onClick={() => moveDepartment(index, 1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowDown size={14} /></button></div>)}</div></div>}
      {tab === 'server' && <div className="space-y-5"><label className="block max-w-sm text-sm font-semibold">Default server view<select disabled={!canEdit} value={workspace.profiles.server.default_open?.kind === 'department' ? `department:${workspace.profiles.server.default_open.department_id}` : 'shortcuts'} onChange={(event) => updateProfile('server', { ...workspace.profiles.server, default_open: event.target.value === 'shortcuts' ? { kind: 'shortcuts' } : { kind: 'department', department_id: event.target.value.replace(/^department:/, '') } })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3"><option value="shortcuts">Quick Menu</option>{workspace.departments.map((department) => <option key={department.id} value={`department:${department.id}`}>{department.name}</option>)}</select></label><ShortcutEditor title="Server Quick Menu" description="Add and rank common server items. There is no fixed shortcut count; the POS shows only what fits after departments." profile={workspace.profiles.server} items={workspace.items} disabled={!canEdit} onChange={(profile) => updateProfile('server', profile)} /></div>}
      {tab === 'bartender' && <div className="space-y-5"><div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">Fast Bar is a complete bartender screen. Search, New Tab, Attach Tab, Tabs, and every department remain available.</div><ShortcutEditor title="Fast Bar items" description="Add and rank common pours and food items. Bartenders can still browse every department from Fast Bar." profile={workspace.profiles.bartender} items={workspace.items} disabled={!canEdit} onChange={(profile) => updateProfile('bartender', profile)} /></div>}
      {tab === 'homes' && <div><h3 className="text-lg font-semibold">Bartender landing screen</h3><p className="mt-1 text-sm text-dash-secondary">Choose the restaurant default, then override only the bartenders who work differently.</p><label className="mt-5 block max-w-sm text-sm font-semibold">Restaurant default<select disabled={!canEdit} value={workspace.restaurant_bartender_default_home} onChange={(event) => setWorkspace((current) => ({ ...current, restaurant_bartender_default_home: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3"><option value="fast_bar">Fast Bar</option><option value="tabs">Tabs / Orders</option></select></label><div className="mt-5 divide-y divide-dash-border rounded-lg border border-dash-border">{workspace.bartenders.map((bartender) => <label key={bartender.id} className="flex flex-wrap items-center gap-3 px-3 py-3"><span className="min-w-[180px] flex-1"><strong className="block text-sm">{bartender.name}</strong><span className="text-xs text-dash-tertiary">Bartender</span></span><select disabled={!canEdit} value={bartender.home_surface || ''} onChange={(event) => setWorkspace((current) => ({ ...current, bartenders: current.bartenders.map((candidate) => candidate.id === bartender.id ? { ...candidate, home_surface: event.target.value || null } : candidate) }))} className="h-10 min-w-[190px] rounded-md border border-dash-border bg-transparent px-3 text-sm"><option value="">Use restaurant default</option><option value="fast_bar">Fast Bar</option><option value="tabs">Tabs / Orders</option></select></label>)}</div></div>}
    </section>
  </div>
}
