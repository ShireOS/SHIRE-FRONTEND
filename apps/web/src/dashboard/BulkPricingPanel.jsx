import { useEffect, useMemo, useState } from 'react'
import {
  applyPricingChange,
  getPricingWorkspace,
  previewPricingChange,
  updatePricingBatch,
} from '../shared/api/menuPricing'
import {
  DAYS_SHORT,
  Field,
  ItemChecklist,
  MenuEmptyState,
  SectionShell,
  SelectInput,
  SmallButton,
  TextInput,
  money,
} from './components/menuUi'

const initialDraft = () => ({
  name: '',
  scope_type: 'item',
  adjustment_type: 'percent_up',
  adjustment_value: '',
  timing: 'now',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  days_of_week: [1, 2, 3, 4, 5],
  priority: '0',
  preserve_gratuity_basis: true,
})

const adjustmentLabel = rule => ({
  percent_up: `+${rule.adjustment_value}%`,
  amount_up: `+$${Number(rule.adjustment_value).toFixed(2)}`,
  percent_off: `-${rule.adjustment_value}%`,
  amount_off: `-$${Number(rule.adjustment_value).toFixed(2)}`,
  fixed: money(rule.adjustment_value),
}[rule.adjustment_type] || rule.adjustment_type)

const scheduleLabel = rule => {
  if (rule.rule_kind === 'scheduled') return `Starts ${new Date(rule.starts_at).toLocaleString()}`
  if (rule.rule_kind === 'recurring') return `${(rule.days_of_week || []).map(day => DAYS_SHORT[day]).join(', ')} · ${rule.start_time || 'open'}–${rule.end_time || 'close'}`
  return `${rule.start_date || 'Now'} → ${rule.end_date || 'No end'}`
}

function TargetPicker({ restaurants, groups, selected, onChange, onClose }) {
  const [tab, setTab] = useState('restaurants')
  const [groupFilter, setGroupFilter] = useState('all')
  const visibleRestaurants = groupFilter === 'all'
    ? restaurants
    : restaurants.filter(row => (groups.find(group => group.id === groupFilter)?.restaurant_ids || []).includes(row.id))
  const toggleRestaurant = id => onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id])
  const toggleGroup = group => {
    const ids = group.restaurant_ids || []
    const allSelected = ids.length > 0 && ids.every(id => selected.includes(id))
    onChange(allSelected ? selected.filter(id => !ids.includes(id)) : Array.from(new Set([...selected, ...ids])))
  }
  const allVisibleSelected = visibleRestaurants.length > 0 && visibleRestaurants.every(row => selected.includes(row.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-xl border border-white/15 bg-[#151515] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <h3 className="text-xl font-semibold">Apply pricing to</h3>
            <p className="mt-1 text-sm text-dash-secondary">Pricing changes do not alter restaurant grouping.</p>
          </div>
          <SmallButton onClick={onClose}>Done</SmallButton>
        </div>
        <div className="flex gap-2 border-b border-white/10 p-4">
          <SmallButton variant={tab === 'restaurants' ? 'primary' : 'secondary'} onClick={() => setTab('restaurants')}>Restaurants</SmallButton>
          <SmallButton variant={tab === 'groups' ? 'primary' : 'secondary'} onClick={() => setTab('groups')}>Groups</SmallButton>
          <span className="flex-1" />
          <span className="self-center text-sm text-dash-tertiary">{selected.length} selected</span>
        </div>
        <div className="max-h-[58vh] overflow-y-auto p-4">
          {tab === 'restaurants' ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <SelectInput value={groupFilter} onChange={event => setGroupFilter(event.target.value)}>
                  <option value="all">All groups</option>
                  {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </SelectInput>
                <SmallButton onClick={() => onChange(allVisibleSelected
                  ? selected.filter(id => !visibleRestaurants.some(row => row.id === id))
                  : Array.from(new Set([...selected, ...visibleRestaurants.map(row => row.id)])))}>
                  {allVisibleSelected ? 'Clear shown' : 'Select shown'}
                </SmallButton>
              </div>
              {visibleRestaurants.map(row => (
                <button key={row.id} type="button" onClick={() => toggleRestaurant(row.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected.includes(row.id) ? 'border-dash-gold/70 bg-dash-gold/10' : 'border-white/10 bg-white/[0.025]'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected.includes(row.id) ? 'border-dash-gold bg-dash-gold text-black' : 'border-white/25'}`}>{selected.includes(row.id) ? '✓' : ''}</span>
                  <span className="font-medium">{row.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map(group => {
                const ids = group.restaurant_ids || []
                const count = ids.filter(id => selected.includes(id)).length
                return (
                  <button key={group.id} type="button" onClick={() => toggleGroup(group)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left hover:border-dash-gold/60">
                    <span className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: group.color || '#999' }} /><span className="font-medium">{group.name}</span></span>
                    <span className="text-sm text-dash-tertiary">{count}/{ids.length} selected</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PreviewModal({ preview, busy, onCancel, onConfirm }) {
  const total = (preview.targets || []).reduce((sum, target) => sum + target.item_count, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/15 bg-[#151515] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h3 className="text-2xl font-semibold">Review price change</h3><p className="mt-1 text-sm text-dash-secondary">{total} item prices across {preview.targets?.length || 0} restaurants.</p></div>
          <SmallButton onClick={onCancel}>Close</SmallButton>
        </div>
        {preview.issues?.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            <p className="font-semibold">Resolve these mappings before publishing</p>
            {preview.issues.map((issue, index) => <p key={`${issue.restaurant_id}:${issue.source}:${index}`} className="mt-1">{issue.restaurant_name}: {issue.source} was {issue.reason}.</p>)}
          </div>
        )}
        <div className="mt-5 space-y-4">
          {(preview.targets || []).map(target => (
            <section key={target.restaurant_id} className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between"><h4 className="font-semibold">{target.restaurant_name}</h4><span className="text-sm text-dash-tertiary">{target.item_count} items</span></div>
              <div className="mt-2 max-h-56 overflow-y-auto">
                {target.items.map(item => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/5 py-2 text-sm"><span>{item.name}</span><span className="text-dash-tertiary">{money(item.current_price)}</span><span className="font-semibold text-dash-gold">{money(item.new_price)}</span></div>)}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4"><SmallButton onClick={onCancel}>Cancel</SmallButton><SmallButton variant="primary" disabled={busy || preview.issues?.length > 0} onClick={onConfirm}>{busy ? 'Publishing...' : 'Publish pricing'}</SmallButton></div>
      </div>
    </div>
  )
}

export default function BulkPricingPanel({ restaurantId, canEditPrices }) {
  const [workspace, setWorkspace] = useState(null)
  const [draft, setDraft] = useState(initialDraft)
  const [selectedItems, setSelectedItems] = useState(() => new Set())
  const [selectedCategories, setSelectedCategories] = useState(() => new Set())
  const [selectedRestaurants, setSelectedRestaurants] = useState([restaurantId])
  const [showTargets, setShowTargets] = useState(false)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    setError('')
    try {
      const data = await getPricingWorkspace(restaurantId)
      setWorkspace(data)
      setSelectedRestaurants(current => current.length ? current : [restaurantId])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pricing.')
    }
  }
  useEffect(() => {
    setSelectedRestaurants([restaurantId])
    setSelectedItems(new Set())
    setSelectedCategories(new Set())
    void load()
  }, [restaurantId])

  const payload = () => ({
    ...draft,
    restaurant_ids: selectedRestaurants,
    item_ids: Array.from(selectedItems),
    category_ids: Array.from(selectedCategories),
    adjustment_value: Number(draft.adjustment_value),
    priority: Number(draft.priority || 0),
    start_date: draft.start_date || null,
    end_date: draft.end_date || null,
    start_time: draft.start_time || null,
    end_time: draft.end_time || null,
  })

  const review = async () => {
    if (!draft.name.trim()) return setError('Name this pricing change.')
    if (!selectedRestaurants.length) return setError('Choose at least one restaurant.')
    if (draft.adjustment_value === '' || Number(draft.adjustment_value) < 0 || (draft.adjustment_type !== 'fixed' && Number(draft.adjustment_value) === 0)) return setError('Enter a valid non-zero adjustment.')
    setBusy(true); setError('')
    try { setPreview(await previewPricingChange(restaurantId, payload())) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not preview pricing.') }
    finally { setBusy(false) }
  }
  const publish = async () => {
    setBusy(true); setError('')
    try {
      await applyPricingChange(restaurantId, payload())
      setPreview(null); setDraft(initialDraft()); setSelectedItems(new Set()); setSelectedCategories(new Set())
      setNotice('Pricing published. POS devices will refresh automatically.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not publish pricing.') }
    finally { setBusy(false) }
  }

  const batches = useMemo(() => {
    const map = new Map()
    for (const rule of workspace?.rules || []) {
      const id = rule.batch_id || rule.id
      const current = map.get(id) || { ...rule, batch_id: id, count: 0, rules: [], restaurant_ids: [] }
      current.count += 1
      current.rules.push(rule)
      if (!current.restaurant_ids.includes(rule.restaurant_id)) current.restaurant_ids.push(rule.restaurant_id)
      map.set(id, current)
    }
    return Array.from(map.values())
  }, [workspace?.rules])

  const changeBatch = async (batch, action) => {
    setBusy(true); setError('')
    try { await updatePricingBatch(restaurantId, batch.batch_id || batch.id, batch.restaurant_ids, action); await load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update pricing rule.') }
    finally { setBusy(false) }
  }

  if (!workspace) return <SectionShell title="Pricing" description="Loading menu pricing...">{error && <p className="text-sm text-red-200">{error}</p>}</SectionShell>
  return (
    <div className="space-y-5">
      {(error || notice) && <div className={`rounded-xl border p-3 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-100' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'}`}>{error || notice}</div>}
      <SectionShell title="Bulk pricing" description="Raise, reduce, or set prices across selected items, categories, restaurants, or groups. Review every resulting price before publishing." actions={<SmallButton onClick={() => setShowTargets(true)}>{selectedRestaurants.length} restaurant{selectedRestaurants.length === 1 ? '' : 's'}</SmallButton>}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div>
            <div className="mb-3 flex gap-2">
              {['item', 'category', 'all'].map(scope => <SmallButton key={scope} variant={draft.scope_type === scope ? 'primary' : 'secondary'} onClick={() => setDraft(current => ({ ...current, scope_type: scope }))}>{scope === 'item' ? 'Items' : scope === 'category' ? 'Categories' : 'Entire menu'}</SmallButton>)}
            </div>
            {draft.scope_type === 'item' && <ItemChecklist menuItems={workspace.menu_items} selectedIds={selectedItems} onToggle={id => setSelectedItems(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })} onBulk={(ids, shouldSelect) => setSelectedItems(current => { const next = new Set(current); ids.forEach(id => shouldSelect ? next.add(id) : next.delete(id)); return next })} />}
            {draft.scope_type === 'category' && <div className="max-h-72 space-y-2 overflow-y-auto">{workspace.categories.map(category => <button key={category.id} type="button" onClick={() => setSelectedCategories(current => { const next = new Set(current); next.has(category.id) ? next.delete(category.id) : next.add(category.id); return next })} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selectedCategories.has(category.id) ? 'border-dash-gold/60 bg-dash-gold/10' : 'border-white/10 bg-white/[0.025]'}`}><span>{category.name}</span><span>{selectedCategories.has(category.id) ? '✓' : ''}</span></button>)}</div>}
            {draft.scope_type === 'all' && <MenuEmptyState title="Entire menu selected">Every active menu item in each target restaurant will be adjusted.</MenuEmptyState>}
          </div>
          <div className="space-y-4">
            <Field label="Change name"><TextInput value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Fourth of July pricing" /></Field>
            <div className="grid grid-cols-[1.35fr_1fr] gap-3"><Field label="Adjustment"><SelectInput value={draft.adjustment_type} onChange={event => setDraft(current => ({ ...current, adjustment_type: event.target.value }))}><option value="percent_up">Increase by percent</option><option value="amount_up">Increase by dollars</option><option value="percent_off">Decrease by percent</option><option value="amount_off">Decrease by dollars</option><option value="fixed">Set exact price</option></SelectInput></Field><Field label="Value"><TextInput type="number" min="0" step="0.01" value={draft.adjustment_value} onChange={event => setDraft(current => ({ ...current, adjustment_value: event.target.value }))} /></Field></div>
            <Field label="Timing"><SelectInput value={draft.timing} onChange={event => setDraft(current => ({ ...current, timing: event.target.value }))}><option value="now">Permanent · now</option><option value="scheduled">Future · no end date</option><option value="window">Event/date window</option><option value="weekly">Recurring weekly</option></SelectInput></Field>
            {draft.timing !== 'now' && ['percent_off', 'amount_off', 'fixed'].includes(draft.adjustment_type) && (
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 px-3 text-sm text-dash-primary">
                <input type="checkbox" checked={draft.preserve_gratuity_basis} onChange={event => setDraft(current => ({ ...current, preserve_gratuity_basis: event.target.checked }))} className="h-4 w-4 accent-dash-gold" />
                <span>Calculate gratuity using the regular price</span>
              </label>
            )}
            {draft.timing === 'scheduled' && <div className="grid grid-cols-2 gap-3"><Field label="Start date"><TextInput type="date" value={draft.start_date} onChange={event => setDraft(current => ({ ...current, start_date: event.target.value }))} /></Field><Field label="Start time"><TextInput type="time" value={draft.start_time} onChange={event => setDraft(current => ({ ...current, start_time: event.target.value }))} /></Field></div>}
            {draft.timing === 'window' && <><div className="grid grid-cols-2 gap-3"><Field label="Start date"><TextInput type="date" value={draft.start_date} onChange={event => setDraft(current => ({ ...current, start_date: event.target.value }))} /></Field><Field label="End date"><TextInput type="date" value={draft.end_date} onChange={event => setDraft(current => ({ ...current, end_date: event.target.value }))} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Daily start"><TextInput type="time" value={draft.start_time} onChange={event => setDraft(current => ({ ...current, start_time: event.target.value }))} /></Field><Field label="Daily end"><TextInput type="time" value={draft.end_time} onChange={event => setDraft(current => ({ ...current, end_time: event.target.value }))} /></Field></div></>}
            {draft.timing === 'weekly' && <><div className="flex flex-wrap gap-1.5">{DAYS_SHORT.map((label, day) => <SmallButton key={label} variant={draft.days_of_week.includes(day) ? 'primary' : 'secondary'} onClick={() => setDraft(current => ({ ...current, days_of_week: current.days_of_week.includes(day) ? current.days_of_week.filter(value => value !== day) : [...current.days_of_week, day] }))}>{label}</SmallButton>)}</div><div className="grid grid-cols-2 gap-3"><Field label="Starts"><TextInput type="time" value={draft.start_time} onChange={event => setDraft(current => ({ ...current, start_time: event.target.value }))} /></Field><Field label="Ends"><TextInput type="time" value={draft.end_time} onChange={event => setDraft(current => ({ ...current, end_time: event.target.value }))} /></Field></div></>}
            <SmallButton variant="primary" disabled={!canEditPrices || busy} onClick={() => void review()}>{busy ? 'Checking...' : 'Review prices'}</SmallButton>
            {!canEditPrices && <p className="text-xs text-dash-tertiary">Your role does not include menu price editing.</p>}
          </div>
        </div>
      </SectionShell>

      <SectionShell title="Scheduled and recurring pricing" description="Expired rows remain here for audit. Pause or archive active rules without changing historical order prices.">
        {batches.length === 0 ? <MenuEmptyState title="No scheduled pricing">Date-window, future, and recurring price rules will appear here.</MenuEmptyState> : <div className="space-y-2">{batches.map(batch => <div key={batch.batch_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{batch.name}</p><p className="mt-1 text-sm text-dash-tertiary">{adjustmentLabel(batch)} · {scheduleLabel(batch)} · {batch.count} target{batch.count === 1 ? '' : 's'}{batch.preserve_gratuity_basis ? ' · Regular-price gratuity' : ''}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs ${batch.archived_at ? 'border-white/10 text-dash-tertiary' : batch.is_active ? 'border-emerald-400/30 text-emerald-200' : 'border-amber-400/30 text-amber-200'}`}>{batch.archived_at ? 'Archived' : batch.is_active ? 'Enabled' : 'Paused'}</span>{!batch.archived_at && <SmallButton disabled={busy || !canEditPrices} onClick={() => void changeBatch(batch, batch.is_active ? 'pause' : 'resume')}>{batch.is_active ? 'Pause' : 'Resume'}</SmallButton>}{!batch.archived_at && <SmallButton variant="danger" disabled={busy || !canEditPrices} onClick={() => void changeBatch(batch, 'archive')}>Archive</SmallButton>}</div>)}</div>}
      </SectionShell>
      {showTargets && <TargetPicker restaurants={workspace.available_restaurants || []} groups={workspace.groups || []} selected={selectedRestaurants} onChange={setSelectedRestaurants} onClose={() => setShowTargets(false)} />}
      {preview && <PreviewModal preview={preview} busy={busy} onCancel={() => setPreview(null)} onConfirm={() => void publish()} />}
    </div>
  )
}
