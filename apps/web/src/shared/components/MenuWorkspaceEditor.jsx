import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Search, X } from 'lucide-react'
import { applyPosMenuWorkspace, fetchPosMenuWorkspace } from '../api/menuWorkspace'
import { viewVisible } from '../backOfficeView'

const TABS = [
  ['navigation', 'Navigation'],
  ['server', 'Server Quick Menu'],
  ['bartender', 'Fast Bar'],
  ['homes', 'Bartender homes'],
]

const NAVIGATION_MODES = [
  ['legacy_top', 'Classic · Original departments (legacy)'],
  ['smart', 'Smart'],
  ['items', 'Items Only · No navigation'],
  ['departments', 'Classic · Original departments'],
  ['families', 'Compact · One rail'],
  ['families_departments', 'Compound · Two rails'],
]

const SURFACE_MODES = [['inherit', 'Use restaurant default'], ...NAVIGATION_MODES]

const emptyProfile = (surface) => ({
  surface,
  shortcut_item_ids: [],
  browse_department_ids: [],
  default_open: null,
  quick_menu_enabled: true,
})

function rankNavigationNodes(nodes) {
  const families = nodes.filter((node) => node.kind === 'family')
  const departments = nodes.filter((node) => node.kind === 'department')
  const familyIds = new Set(families.map((family) => family.id))
  const ordered = []
  for (const family of families) {
    ordered.push({ ...family, parent_id: null })
    ordered.push(...departments.filter((department) => department.parent_id === family.id))
  }
  ordered.push(...departments.filter((department) => !department.parent_id || !familyIds.has(department.parent_id)).map((department) => ({ ...department, parent_id: null })))
  return ordered.map((node, display_order) => ({ ...node, display_order }))
}

function createFamilyId() {
  if (globalThis.crypto?.randomUUID) return `family:${globalThis.crypto.randomUUID()}`
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16)
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
  return `family:${uuid}`
}

function normalizeWorkspace(value) {
  const version = Number(value?.version || 0)
  const rawDepartments = Array.isArray(value?.departments)
    ? [...value.departments].sort((a, b) => Number(a.display_order) - Number(b.display_order))
    : []
  const rawNodes = Array.isArray(value?.navigation_nodes) && value.navigation_nodes.length
    ? value.navigation_nodes
    : rawDepartments.map((department) => ({ ...department, kind: 'department', parent_id: null }))
  const navigationNodes = rankNavigationNodes(rawNodes.map((node, index) => ({
    ...node,
    kind: node.kind === 'family' ? 'family' : 'department',
    parent_id: node.kind === 'family' ? null : node.parent_id || null,
    display_order: Number.isFinite(Number(node.display_order)) ? Number(node.display_order) : index,
  })))
  const departments = navigationNodes
    .filter((node) => node.kind === 'department')
    .map(({ kind: _kind, parent_id: _parentId, ...department }) => department)
  const departmentIds = departments.map((department) => department.id)
  const rawServerDefault = value?.profiles?.server?.default_open
  const serverDefaultOpen = rawServerDefault?.kind === 'shortcuts'
    ? { kind: 'shortcuts' }
    : rawServerDefault?.kind === 'department' && departmentIds.includes(rawServerDefault.department_id)
      ? { kind: 'department', department_id: rawServerDefault.department_id }
      : { kind: 'shortcuts' }
  return {
    version,
    updated_at: value?.updated_at || null,
    departments,
    navigation_nodes: navigationNodes,
    navigation: {
      default_mode: version === 0
        ? 'smart'
        : NAVIGATION_MODES.some(([id]) => id === value?.navigation?.default_mode)
          ? value.navigation.default_mode
          : 'legacy_top',
      server_mode: SURFACE_MODES.some(([id]) => id === value?.navigation?.server_mode) ? value.navigation.server_mode : 'inherit',
      bartender_mode: SURFACE_MODES.some(([id]) => id === value?.navigation?.bartender_mode) ? value.navigation.bartender_mode : 'inherit',
    },
    items: Array.isArray(value?.items) ? value.items : [],
    profiles: {
      server: { ...emptyProfile('server_menu'), ...value?.profiles?.server, browse_department_ids: departmentIds, default_open: serverDefaultOpen, quick_menu_enabled: value?.profiles?.server?.quick_menu_enabled !== false },
      bartender: { ...emptyProfile('fast_bar'), ...value?.profiles?.bartender, browse_department_ids: departmentIds, quick_menu_enabled: value?.profiles?.bartender?.quick_menu_enabled !== false },
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

function OrganizationEditor({
  families,
  departments,
  canEdit,
  addFamily,
  moveFamily,
  removeFamily,
  moveDepartment,
  departmentSiblingTarget,
  updateNodes,
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Overall groups</h3>
            <p className="mt-1 text-sm text-dash-secondary">Optional top-level groups such as Food, Wine, or Beer. Departments remain the familiar menu categories beneath them.</p>
          </div>
          <button type="button" disabled={!canEdit} onClick={addFamily} className="inline-flex h-10 items-center gap-2 rounded-lg border border-dash-border px-3 text-sm font-semibold disabled:opacity-40"><Plus size={15} />Add overall group</button>
        </div>
        {families.length ? (
          <div className="mt-4 divide-y divide-dash-border rounded-lg border border-dash-border">
            {families.map((family, index) => (
              <div key={family.id} className="flex flex-wrap items-center gap-2 px-3 py-3">
                <input aria-label={`${family.name} overall group name`} disabled={!canEdit} value={family.name} onChange={(event) => updateNodes((nodes) => nodes.map((node) => node.id === family.id ? { ...node, name: event.target.value } : node))} className="h-10 min-w-[180px] flex-1 rounded-md border border-dash-border bg-transparent px-3 text-sm font-semibold" />
                <span className="text-xs text-dash-tertiary">{departments.filter((department) => department.parent_id === family.id).length} departments</span>
                <button type="button" aria-label={`Move ${family.name} up`} disabled={!canEdit || index === 0} onClick={() => moveFamily(index, -1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" aria-label={`Move ${family.name} down`} disabled={!canEdit || index === families.length - 1} onClick={() => moveFamily(index, 1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" aria-label={`Remove ${family.name}`} disabled={!canEdit} onClick={() => removeFamily(family.id)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><X size={14} /></button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-dash-border p-4 text-sm text-dash-tertiary">No overall groups configured. Departments continue to work on their own.</p>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold">Departments</h3>
        <p className="mt-1 text-sm text-dash-secondary">Place each Department inside an optional Overall Group. Removing a group returns its Departments to ungrouped.</p>
        <div className="mt-4 divide-y divide-dash-border rounded-lg border border-dash-border">
          {departments.map((department, index) => (
            <div key={department.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <span className="w-7 font-mono text-xs text-dash-tertiary">{index + 1}</span>
              <strong className="min-w-[160px] flex-1 truncate text-sm">{department.name}</strong>
              <select aria-label={`${department.name} overall group`} disabled={!canEdit} value={department.parent_id || ''} onChange={(event) => updateNodes((nodes) => nodes.map((node) => node.id === department.id ? { ...node, parent_id: event.target.value || null } : node))} className="h-10 min-w-[180px] rounded-md border border-dash-border bg-transparent px-3 text-sm">
                <option value="">No overall group</option>
                {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
              </select>
              <button type="button" aria-label={`Move ${department.name} up`} disabled={!canEdit || departmentSiblingTarget(index, -1) < 0} onClick={() => moveDepartment(index, -1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" aria-label={`Move ${department.name} down`} disabled={!canEdit || departmentSiblingTarget(index, 1) < 0} onClick={() => moveDepartment(index, 1)} className="grid h-9 w-9 place-items-center rounded-md border border-dash-border disabled:opacity-30"><ArrowDown size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MenuWorkspaceEditor({
  restaurantId,
  canEdit = true,
  compact = false,
  onPreviewChange,
  viewPolicy = null,
  section = 'pos-menus',
  onNavigateToOrganization = null,
  onNavigateToPosMenus = null,
}) {
  const [tab, setTab] = useState('navigation')
  const visibleTabs = useMemo(() => TABS.filter(([id]) => viewVisible(viewPolicy, {
    navigation: 'pos_menu.navigation',
    server: 'pos_menu.quick_menu',
    bartender: 'pos_menu.fast_bar',
    homes: 'pos_menu.bartender_defaults',
  }[id])), [viewPolicy])
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

  useEffect(() => {
    onPreviewChange?.(workspace)
  }, [onPreviewChange, workspace])

  useEffect(() => {
    if (!visibleTabs.some(([id]) => id === tab)) setTab(visibleTabs[0]?.[0] || 'navigation')
  }, [tab, visibleTabs])

  const updateNodes = (updater) => setWorkspace((current) => {
    const nextNodes = rankNavigationNodes(typeof updater === 'function' ? updater(current.navigation_nodes) : updater)
    const departments = nextNodes.filter((node) => node.kind === 'department').map(({ kind: _kind, parent_id: _parentId, ...department }) => department)
    const browse = departments.map((department) => department.id)
    return {
      ...current,
      navigation_nodes: nextNodes,
      departments,
      profiles: {
        server: { ...current.profiles.server, browse_department_ids: browse },
        bartender: { ...current.profiles.bartender, browse_department_ids: browse },
      },
    }
  })
  const updateProfile = (key, profile) => setWorkspace((current) => ({ ...current, profiles: { ...current.profiles, [key]: profile } }))
  const families = workspace?.navigation_nodes.filter((node) => node.kind === 'family') || []
  const departments = workspace?.navigation_nodes.filter((node) => node.kind === 'department') || []
  const familyIdsWithDepartments = new Set(departments.map((department) => department.parent_id).filter(Boolean))
  const emptyFamilies = families.filter((family) => !familyIdsWithDepartments.has(family.id))
  const familyModeSelected = workspace
    ? [workspace.navigation.default_mode, workspace.navigation.server_mode, workspace.navigation.bartender_mode].some((mode) => mode === 'families' || mode === 'families_departments')
    : false
  const unassignedDepartments = departments.filter((department) => !department.parent_id)
  const configurationBlocked = emptyFamilies.length > 0 || (familyModeSelected && unassignedDepartments.length > 0)
  const dirty = Boolean(workspace && saved && JSON.stringify(workspace) !== JSON.stringify(saved))

  const addFamily = () => {
    const id = createFamilyId()
    updateNodes((nodes) => [...nodes, { id, name: 'New overall group', kind: 'family', parent_id: null, display_order: nodes.length }])
  }
  const moveFamily = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= families.length) return
    const reordered = [...families]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    updateNodes([...reordered, ...departments])
  }
  const removeFamily = (familyId) => updateNodes((nodes) => nodes
    .filter((node) => node.id !== familyId)
    .map((node) => node.parent_id === familyId ? { ...node, parent_id: null } : node))
  const departmentSiblingTarget = (index, delta) => {
    const source = departments[index]
    if (!source) return -1
    const siblingIndexes = departments
      .map((department, departmentIndex) => department.parent_id === source.parent_id ? departmentIndex : -1)
      .filter((departmentIndex) => departmentIndex >= 0)
    const siblingIndex = siblingIndexes.indexOf(index)
    return siblingIndexes[siblingIndex + delta] ?? -1
  }
  const moveDepartment = (index, delta) => {
    const target = departmentSiblingTarget(index, delta)
    if (target < 0) return
    const reordered = [...departments]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    updateNodes([...families, ...reordered])
  }
  const setQuickMenuEnabled = (key, enabled) => setWorkspace((current) => {
    const profile = { ...current.profiles[key], quick_menu_enabled: enabled }
    if (key === 'server' && !enabled && profile.default_open?.kind === 'shortcuts') {
      profile.default_open = current.departments[0]
        ? { kind: 'department', department_id: current.departments[0].id }
        : null
    }
    return { ...current, profiles: { ...current.profiles, [key]: profile } }
  })

  const save = async () => {
    setSaving(true)
    setStatus({ tone: '', text: '' })
    try {
      const normalized = normalizeWorkspace(await applyPosMenuWorkspace(restaurantId, workspace, reason))
      setWorkspace(normalized)
      setSaved(normalized)
      setReason('')
      setStatus({
        tone: 'success',
        text: section === 'organization'
          ? 'Menu organization saved. Paired devices receive it on refresh.'
          : 'POS menu navigation saved. Paired devices receive it on refresh.',
      })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save POS menus.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="rounded-lg border border-dash-border p-5 text-sm text-dash-secondary">Loading POS menu workspace…</div>
  if (!workspace) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{status.text || 'POS menu workspace is unavailable.'}</div>

  const organizationSection = section === 'organization'

  return <div className={compact ? 'space-y-4' : 'space-y-5'}>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="label-mono">{organizationSection ? 'Menu' : 'POS menus'}</p>
        <h2 className="mt-1 text-2xl font-semibold">{organizationSection ? 'Menu organization' : 'Adaptive menu navigation'}</h2>
        <p className="mt-2 max-w-3xl text-sm text-dash-secondary">
          {organizationSection
            ? 'Create optional Overall Groups such as Food, Wine, or Beer, then place the existing Departments beneath them.'
            : 'Choose how the existing Overall Groups and Departments appear on each POS surface. Item and modifier behavior stays unchanged.'}
        </p>
      </div>
      <div className="w-full max-w-sm">
        <label className="block text-xs font-semibold">Change reason<input disabled={!canEdit} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this layout changing?" className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3 text-sm" /></label>
        <button type="button" disabled={!canEdit || !dirty || !reason.trim() || saving || configurationBlocked} onClick={() => void save()} className="mt-2 h-10 w-full rounded-lg bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-40">{saving ? 'Saving…' : organizationSection ? 'Save organization' : 'Save POS menus'}</button>
      </div>
    </header>
    {!canEdit && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">You can view this configuration. Editing requires Menu: Edit items & modifiers.</div>}
    {configurationBlocked && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"><span>{emptyFamilies.length ? 'Assign at least one Department to every Overall Group before saving.' : 'Overall Group modes require every Department to belong to a group.'}</span>{!organizationSection && onNavigateToOrganization && <button type="button" onClick={onNavigateToOrganization} className="rounded-md border border-amber-200/30 px-3 py-1.5 text-xs font-semibold">Fix in Organization</button>}</div>}
    {status.text && <div className={`rounded-lg border p-3 text-sm ${status.tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{status.text}</div>}
    {!organizationSection && <div className="flex flex-wrap rounded-lg border border-dash-border p-1">{visibleTabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`min-w-[150px] flex-1 rounded-md px-3 py-2.5 text-sm font-semibold ${tab === id ? 'bg-shell-cta text-shell-cta-text' : 'text-dash-secondary'}`}>{label}</button>)}</div>}
    <section className="rounded-lg border border-dash-border bg-[var(--glass-bg)] p-4 sm:p-5">
      {organizationSection ? (
        <OrganizationEditor
          families={families}
          departments={departments}
          canEdit={canEdit}
          addFamily={addFamily}
          moveFamily={moveFamily}
          removeFamily={removeFamily}
          moveDepartment={moveDepartment}
          departmentSiblingTarget={departmentSiblingTarget}
          updateNodes={updateNodes}
        />
      ) : tab === 'navigation' && <div className="space-y-6">
        <div><h3 className="text-lg font-semibold">Navigation modes</h3><p className="mt-1 text-sm text-dash-secondary">Compact uses one interchangeable rail, Compound keeps Overall Groups and Departments visible together, Classic preserves the original Department shelf, and Items Only removes navigation. Smart uses the configured structure and never invents Food, Beer, or Wine.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Restaurant default<select disabled={!canEdit} value={workspace.navigation.default_mode} onChange={(event) => setWorkspace((current) => ({ ...current, navigation: { ...current.navigation, default_mode: event.target.value } }))} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3">{NAVIGATION_MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="text-sm font-semibold">Server Menu<select disabled={!canEdit} value={workspace.navigation.server_mode} onChange={(event) => setWorkspace((current) => ({ ...current, navigation: { ...current.navigation, server_mode: event.target.value } }))} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3">{SURFACE_MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="text-sm font-semibold">Fast Bar<select disabled={!canEdit} value={workspace.navigation.bartender_mode} onChange={(event) => setWorkspace((current) => ({ ...current, navigation: { ...current.navigation, bartender_mode: event.target.value } }))} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3">{SURFACE_MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dash-border bg-white/[0.025] p-4">
          <div><h3 className="text-sm font-semibold">Menu organization</h3><p className="mt-1 text-xs text-dash-secondary">{families.length} Overall Group{families.length === 1 ? '' : 's'} · {departments.length} Departments. Group creation and assignment now live under Menu → Organization.</p></div>
          {onNavigateToOrganization && <button type="button" onClick={onNavigateToOrganization} className="rounded-lg border border-dash-border px-3 py-2 text-sm font-semibold">Manage organization</button>}
        </div>
      </div>}
      {!organizationSection && tab === 'server' && <div className="space-y-5"><label className="flex items-start gap-3 rounded-lg border border-dash-border p-4"><input type="checkbox" disabled={!canEdit} checked={workspace.profiles.server.quick_menu_enabled} onChange={(event) => setQuickMenuEnabled('server', event.target.checked)} className="mt-1" /><span><strong className="block text-sm">Keep Quick Menu available</strong><span className="mt-1 block text-xs text-dash-secondary">Enabled by default in Compact, Compound, and Classic. Items Only deliberately opens the complete item grid with no navigation.</span></span></label><label className="block max-w-sm text-sm font-semibold">Default server view<select disabled={!canEdit} value={workspace.profiles.server.default_open?.kind === 'department' ? `department:${workspace.profiles.server.default_open.department_id}` : 'shortcuts'} onChange={(event) => updateProfile('server', { ...workspace.profiles.server, default_open: event.target.value === 'shortcuts' ? { kind: 'shortcuts' } : { kind: 'department', department_id: event.target.value.replace(/^department:/, '') } })} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3"><option disabled={!workspace.profiles.server.quick_menu_enabled} value="shortcuts">Quick Menu</option>{workspace.departments.map((department) => <option key={department.id} value={`department:${department.id}`}>{department.name}</option>)}</select></label><ShortcutEditor title="Server Quick Menu" description="The existing configured favorites are reused; no items are duplicated." profile={workspace.profiles.server} items={workspace.items} disabled={!canEdit} onChange={(profile) => updateProfile('server', profile)} /></div>}
      {!organizationSection && tab === 'bartender' && <div className="space-y-5"><label className="flex items-start gap-3 rounded-lg border border-dash-border p-4"><input type="checkbox" disabled={!canEdit} checked={workspace.profiles.bartender.quick_menu_enabled} onChange={(event) => setQuickMenuEnabled('bartender', event.target.checked)} className="mt-1" /><span><strong className="block text-sm">Keep ★ FAST pinned</strong><span className="mt-1 block text-xs text-dash-secondary">Enabled by default; it continues to use the existing Fast Bar items.</span></span></label><div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">Fast Bar retains search, tab actions, Recent, quantity controls, and every Department.</div><ShortcutEditor title="Fast Bar items" description="Add and rank common pours and food items." profile={workspace.profiles.bartender} items={workspace.items} disabled={!canEdit} onChange={(profile) => updateProfile('bartender', profile)} /></div>}
      {!organizationSection && tab === 'homes' && <div><h3 className="text-lg font-semibold">Bartender landing screen</h3><p className="mt-1 text-sm text-dash-secondary">Choose the restaurant default, then override only the bartenders who work differently.</p><label className="mt-5 block max-w-sm text-sm font-semibold">Restaurant default<select disabled={!canEdit} value={workspace.restaurant_bartender_default_home} onChange={(event) => setWorkspace((current) => ({ ...current, restaurant_bartender_default_home: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-dash-border bg-transparent px-3"><option value="fast_bar">Fast Bar</option><option value="tabs">Tabs / Orders</option></select></label><div className="mt-5 divide-y divide-dash-border rounded-lg border border-dash-border">{workspace.bartenders.map((bartender) => <label key={bartender.id} className="flex flex-wrap items-center gap-3 px-3 py-3"><span className="min-w-[180px] flex-1"><strong className="block text-sm">{bartender.name}</strong><span className="text-xs text-dash-tertiary">Bartender</span></span><select disabled={!canEdit} value={bartender.home_surface || ''} onChange={(event) => setWorkspace((current) => ({ ...current, bartenders: current.bartenders.map((candidate) => candidate.id === bartender.id ? { ...candidate, home_surface: event.target.value || null } : candidate) }))} className="h-10 min-w-[190px] rounded-md border border-dash-border bg-transparent px-3 text-sm"><option value="">Use restaurant default</option><option value="fast_bar">Fast Bar</option><option value="tabs">Tabs / Orders</option></select></label>)}</div></div>}
    </section>
    {organizationSection && onNavigateToPosMenus && <div className="flex justify-end"><button type="button" onClick={onNavigateToPosMenus} className="rounded-lg border border-dash-border px-3 py-2 text-sm font-semibold">Continue to POS Menus</button></div>}
  </div>
}
