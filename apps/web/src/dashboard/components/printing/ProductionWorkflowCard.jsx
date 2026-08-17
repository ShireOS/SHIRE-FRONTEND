import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { applyProductionWorkflow, fetchProductionWorkflow } from '../../../shared/api/productionWorkflow'

const MODES = [
  ['made_at_pos', 'Made at POS', 'No Drinks destination and no beverage production ticket for bartenders.'],
  ['printer', 'Bar printer', 'Send beverages directly to the configured printer; hide Drinks.'],
  ['screen', 'Drinks screen', 'Send beverages to the Drinks queue without printing.'],
  ['screen_printer', 'Screen + printer', 'Send beverages to both configured production outputs.'],
]

const blankOverride = () => ({ role_key: 'bartender', waiter_id: null, menu_item_id: null, category: null, station_id: null, device_id: null, behavior: 'make_here' })

export default function ProductionWorkflowCard({ restaurantId }) {
  const [workflow, setWorkflow] = useState(null)
  const [savedWorkflow, setSavedWorkflow] = useState(null)
  const [reason, setReason] = useState('Update production workflow')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let current = true
    fetchProductionWorkflow(restaurantId)
      .then(value => { if (current) { setWorkflow(value); setSavedWorkflow(value) } })
      .catch(err => { if (current) setError(err?.message || 'Could not load production workflow') })
    return () => { current = false }
  }, [restaurantId])

  const roles = useMemo(() => Array.from(new Set((workflow?.staff_options || []).map(staff => staff.role).filter(Boolean))).sort(), [workflow])
  const categories = useMemo(() => Array.from(new Set((workflow?.item_options || []).map(item => item.category).filter(Boolean))).sort(), [workflow])

  const patchOverride = (index, patch) => setWorkflow(current => ({
    ...current,
    overrides: current.overrides.map((row, position) => position === index ? { ...row, ...patch } : row),
  }))

  const save = async () => {
    if (!reason.trim()) { setError('Enter a reason for the audit log.'); return }
    setSaving(true); setError(''); setMessage('')
    try {
      const saved = await applyProductionWorkflow(restaurantId, workflow, reason)
      setWorkflow(saved)
      setSavedWorkflow(saved)
      setMessage('Production workflow saved. POS destinations and add behavior now use this policy.')
    } catch (err) {
      setError(err?.message || 'Could not save production workflow')
    } finally { setSaving(false) }
  }

  const discard = () => {
    if (!savedWorkflow || saving) return
    setWorkflow(structuredClone(savedWorkflow))
    setReason('Update production workflow')
    setError('')
    setMessage('Changes discarded.')
  }

  if (!workflow) return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-dash-tertiary">{error || 'Loading production workflow…'}</div>

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div>
        <p className="label-mono">Production behavior</p>
        <h2 className="mt-1 text-xl font-semibold">When an item needs sending</h2>
        <p className="mt-1 max-w-3xl text-sm text-dash-tertiary">Restaurant workflow resolves first, then item/station routing, then the most specific role or employee override. “Make here” marks the line handled without creating a ticket or Drinks queue row.</p>
      </div>
      {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      {message && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div>}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MODES.map(([value, label, help]) => (
          <button key={value} type="button" onClick={() => setWorkflow(current => ({ ...current, beverage_mode: value }))} className={`rounded-xl border p-4 text-left ${workflow.beverage_mode === value ? 'border-dash-gold bg-dash-gold/10' : 'border-white/10 bg-black/15'}`}>
            <span className="text-sm font-semibold text-dash-cream">{label}</span>
            <span className="mt-1 block text-xs leading-5 text-dash-tertiary">{help}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4">
        <p className="text-sm font-semibold">Beverage-production roles</p>
        <p className="mt-1 text-xs text-dash-tertiary">Only these working roles enter the clock-in production-area flow. Employee production overrides still win afterward.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map(role => {
            const selected = (workflow.beverage_roles || ['bartender']).includes(role)
            return <button key={role} type="button" onClick={() => setWorkflow(current => ({ ...current, beverage_roles: selected ? (current.beverage_roles || ['bartender']).filter(value => value !== role) : [...(current.beverage_roles || []), role] }))} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected ? 'border-dash-gold bg-dash-gold/10 text-dash-gold' : 'border-white/10 text-dash-tertiary'}`}>{role}</button>
          })}
        </div>
      </div>
      {['screen', 'screen_printer'].includes(workflow.beverage_mode) && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-4">
          <p className="text-sm font-semibold">Named Drinks screen targets</p>
          <p className="mt-1 text-xs text-dash-tertiary">Drinks appears only for an active session that resolves at least one mapped screen target. Item/category and section routing still choose the production station.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(workflow.screen_target_options || []).map(target => <span key={`${target.id}:${target.station_id}`} className={`rounded-full border px-3 py-1 text-xs ${target.pos_device_id ? 'border-emerald-400/30 text-emerald-100' : 'border-amber-400/30 text-amber-100'}`}>{target.name} · {target.station_name}{target.pos_device_id ? '' : ' · terminal not mapped'}</span>)}
            {(workflow.screen_target_options || []).length === 0 && <span className="text-xs text-amber-100">No active screen target is mapped. Drinks will remain hidden.</span>}
          </div>
        </div>
      )}

      {['screen', 'screen_printer'].includes(workflow.beverage_mode) && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Terminal production-area access</p><p className="mt-1 text-xs text-dash-tertiary">This controls clock-in compatibility and queue access. It is separate from the physical device attached to a KDS output target.</p></div><button type="button" disabled={!workflow.device_options.length || !workflow.station_options.length} onClick={() => setWorkflow(current => ({ ...current, device_access: [...(current.device_access || []), { device_id: current.device_options[0]?.id, station_id: current.station_options[0]?.id, is_default: false }] }))} className="inline-flex items-center gap-2 rounded-lg border border-dash-gold/40 px-3 py-2 text-xs font-semibold text-dash-gold disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Map area</button></div>
          <div className="mt-3 space-y-2">
            {(workflow.device_access || []).map((access, index) => <div key={`${access.device_id}:${access.station_id}:${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto_40px]"><select value={access.device_id} onChange={event => setWorkflow(current => ({ ...current, device_access: current.device_access.map((row, position) => position === index ? { ...row, device_id: event.target.value } : row) }))} className="rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm">{workflow.device_options.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}</select><select value={access.station_id} onChange={event => setWorkflow(current => ({ ...current, device_access: current.device_access.map((row, position) => position === index ? { ...row, station_id: event.target.value } : row) }))} className="rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm">{workflow.station_options.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select><label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-dash-secondary"><input type="checkbox" checked={Boolean(access.is_default)} onChange={event => setWorkflow(current => ({ ...current, device_access: current.device_access.map((row, position) => ({ ...row, is_default: position === index ? event.target.checked : event.target.checked && row.device_id === access.device_id ? false : row.is_default })) }))} /> Default</label><button type="button" aria-label="Remove terminal mapping" onClick={() => setWorkflow(current => ({ ...current, device_access: current.device_access.filter((_, position) => position !== index) }))} className="grid h-10 w-10 place-items-center rounded-lg text-dash-tertiary hover:bg-red-400/10 hover:text-red-200"><Trash2 className="h-4 w-4" /></button></div>)}
            {(workflow.device_access || []).length === 0 && <p className="text-xs text-amber-100">No terminal access mappings. Beverage-role clock-in will block when screen areas exist but this terminal has no compatible area.</p>}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <div><h3 className="font-semibold">Role & employee overrides</h3><p className="text-xs text-dash-tertiary">Optional station and item scopes make the rule more specific.</p></div>
        <button type="button" onClick={() => setWorkflow(current => ({ ...current, overrides: [...current.overrides, blankOverride()] }))} className="inline-flex items-center gap-2 rounded-xl border border-dash-gold/40 px-3 py-2 text-sm font-semibold text-dash-gold"><Plus className="h-4 w-4" /> Add override</button>
      </div>

      <div className="mt-3 space-y-3">
        {workflow.overrides.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-dash-tertiary">No overrides. Servers keep Review then Send; bartender beverages follow the workflow above.</div>}
        {workflow.overrides.map((row, index) => {
          const actorType = row.waiter_id ? 'employee' : 'role'
          const scopeType = row.menu_item_id ? 'item' : row.category ? 'category' : 'all'
          return <div key={row.id || index} className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3 lg:grid-cols-[120px_1fr_120px_1fr_minmax(360px,1.4fr)_42px]">
            <select value={actorType} onChange={event => patchOverride(index, event.target.value === 'employee' ? { waiter_id: workflow.staff_options[0]?.id || null, role_key: null } : { waiter_id: null, role_key: roles[0] || 'server' })} className="rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm"><option value="role">Role</option><option value="employee">Employee</option></select>
            <select value={row.waiter_id || row.role_key || ''} onChange={event => patchOverride(index, actorType === 'employee' ? { waiter_id: event.target.value } : { role_key: event.target.value })} className="rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm">{actorType === 'employee' ? workflow.staff_options.map(staff => <option key={staff.id} value={staff.id}>{staff.name} · {staff.role}</option>) : roles.map(role => <option key={role} value={role}>{role}</option>)}</select>
            <select value={scopeType} onChange={event => patchOverride(index, event.target.value === 'item' ? { menu_item_id: workflow.item_options[0]?.id || null, category: null } : event.target.value === 'category' ? { menu_item_id: null, category: categories[0] || null } : { menu_item_id: null, category: null })} className="rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm"><option value="all">All items</option><option value="category">Category</option><option value="item">Item</option></select>
            <select value={row.menu_item_id || row.category || ''} disabled={scopeType === 'all'} onChange={event => patchOverride(index, scopeType === 'item' ? { menu_item_id: event.target.value } : { category: event.target.value })} className="rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm disabled:opacity-40">{scopeType === 'item' ? workflow.item_options.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : categories.map(category => <option key={category} value={category}>{category}</option>)}</select>
            <div className="grid grid-cols-3 gap-2"><select value={row.station_id || ''} onChange={event => patchOverride(index, { station_id: event.target.value || null })} className="min-w-0 rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm"><option value="">Any station</option>{workflow.station_options.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select><select value={row.device_id || ''} onChange={event => patchOverride(index, { device_id: event.target.value || null })} className="min-w-0 rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm"><option value="">Any terminal</option>{workflow.device_options.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}</select><select value={row.behavior} onChange={event => patchOverride(index, { behavior: event.target.value })} className="min-w-0 rounded-lg border border-white/10 bg-dash-card px-2 py-2 text-sm"><option value="manual">Review then Send</option><option value="auto_send">Send on add</option><option value="make_here">Make here</option></select></div>
            <button type="button" aria-label="Remove override" onClick={() => setWorkflow(current => ({ ...current, overrides: current.overrides.filter((_, position) => position !== index) }))} className="grid h-10 w-10 place-items-center rounded-lg text-dash-tertiary hover:bg-red-400/10 hover:text-red-200"><Trash2 className="h-4 w-4" /></button>
          </div>
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="min-w-[280px] flex-1"><span className="label-mono">Reason for change</span><input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
        <button type="button" disabled={saving} onClick={discard} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">Cancel</button>
        <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-dash-gold px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save production behavior'}</button>
      </div>
    </section>
  )
}
