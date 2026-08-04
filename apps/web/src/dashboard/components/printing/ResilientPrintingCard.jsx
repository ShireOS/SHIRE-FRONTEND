import { useEffect, useMemo, useState } from 'react'
import { Cable, Network, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { fetchPosApi } from '../../../shared/api/posClient'
import PrinterEndpointEditModal from './PrinterEndpointEditModal'

const emptyForm = { target_id: '', name: '', connection_type: 'usb', priority: 2, agent_device_id: '', agent_host: '', host: '', port: 9100, vendor_id: '', product_id: '', reason: '' }

export default function ResilientPrintingCard({ restaurantId }) {
  const [data, setData] = useState({ targets: [], endpoints: [], devices: [], recent_attempts: [] })
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingEndpoint, setEditingEndpoint] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const value = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/print-infrastructure`, { cache: 'no-store' })
      setData(value)
      setForm(current => ({ ...current, target_id: current.target_id || value.targets?.[0]?.id || '' }))
    } catch (err) { setError(err?.message || 'Could not load resilient printing') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [restaurantId])

  const grouped = useMemo(() => data.targets.map(target => ({
    ...target,
    endpoints: data.endpoints.filter(endpoint => endpoint.target_id === target.id).sort((a, b) => a.priority - b.priority),
  })), [data])

  const addEndpoint = async event => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const config = form.connection_type === 'network'
        ? { host: form.host.trim(), port: Number(form.port) || 9100 }
        : {
            ...(form.vendor_id ? { vendor_id: Number(form.vendor_id) } : {}),
            ...(form.product_id ? { product_id: Number(form.product_id) } : {}),
            ...(form.agent_host ? { agent_host: form.agent_host.trim(), agent_port: 9751 } : {}),
          }
      await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/print-infrastructure/endpoints`, {
        method: 'POST',
        body: JSON.stringify({
          target_id: form.target_id,
          name: form.name.trim() || `${form.connection_type === 'usb' ? 'USB fallback' : 'Ethernet'} path`,
          connection_type: form.connection_type,
          priority: Number(form.priority),
          agent_device_id: form.agent_device_id || null,
          config,
          is_active: true,
          reason: form.reason.trim() || 'Configured in Backoffice',
        }),
      })
      setForm(current => ({ ...emptyForm, target_id: current.target_id }))
      await load()
    } catch (err) { setError(err?.message || 'Could not add printer path') }
    finally { setSaving(false) }
  }

  const removeEndpoint = async endpoint => {
    if (!window.confirm(`Remove ${endpoint.name}? Jobs will use the remaining paths.`)) return
    try {
      await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/print-infrastructure/endpoints/${endpoint.id}`, { method: 'DELETE' })
      await load()
    } catch (err) { setError(err?.message || 'Could not remove printer path') }
  }

  const startEndpointEdit = endpoint => {
    setError('')
    setEditingEndpoint(endpoint)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-semibold">Resilient printer paths</h2><p className="mt-1 max-w-3xl text-sm text-dash-tertiary">One logical printer can try Ethernet first, then USB through a designated Android terminal. Lower priority runs first; a job is complete only after one path accepts the bytes.</p></div>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-white/10 p-2 text-dash-secondary hover:text-white"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {grouped.map(target => <div key={target.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between"><div><p className="font-medium">{target.name}</p><p className="text-xs text-dash-tertiary">{target.usage || 'kitchen'} printer</p></div><span className={`rounded-full px-2 py-1 text-[11px] ${target.is_active ? 'bg-emerald-400/10 text-emerald-200' : 'bg-white/10 text-dash-tertiary'}`}>{target.is_active ? 'Active' : 'Inactive'}</span></div>
          <div className="mt-3 space-y-2">{target.endpoints.map(endpoint => <div key={endpoint.id} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2">
            {endpoint.connection_type === 'usb' ? <Cable className="h-4 w-4 text-dash-gold" /> : <Network className="h-4 w-4 text-sky-300" />}
            <div className="min-w-0 flex-1"><p className="truncate text-sm">{endpoint.priority}. {endpoint.name}</p><p className="truncate text-xs text-dash-tertiary">{endpoint.connection_type === 'usb' ? `Agent: ${endpoint.agent_device_name || 'not assigned'}` : `${endpoint.config?.host || 'No host'}:${endpoint.config?.port || 9100}`}</p></div>
            {endpoint.connection_type === 'network' && <button type="button" onClick={() => startEndpointEdit(endpoint)} aria-label={`Edit printer IP for ${endpoint.name}`} title="Edit printer IP" className="p-1 text-dash-tertiary hover:text-sky-200"><Pencil className="h-4 w-4" /></button>}
            <button type="button" onClick={() => removeEndpoint(endpoint)} aria-label={`Remove ${endpoint.name}`} title="Remove printer path" className="p-1 text-dash-tertiary hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
          </div>)}{!target.endpoints.length && <p className="text-sm text-amber-200">No delivery path configured.</p>}</div>
        </div>)}
      </div>
      <form onSubmit={addEndpoint} className="mt-5 rounded-xl border border-dash-gold/20 bg-dash-gold/[0.04] p-4">
        <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-dash-gold" /><h3 className="font-medium">Add printer path</h3></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label><span className="label-mono">Physical printer</span><select required value={form.target_id} onChange={e => setForm({ ...form, target_id: e.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">{data.targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          <label><span className="label-mono">Connection</span><select value={form.connection_type} onChange={e => setForm({ ...form, connection_type: e.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"><option value="network">Ethernet</option><option value="usb">USB fallback</option></select></label>
          <label><span className="label-mono">Priority</span><input required type="number" min="1" max="100" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
          <label><span className="label-mono">Path name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kitchen USB fallback" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
          {form.connection_type === 'network' ? <>
            <label><span className="label-mono">Printer IP</span><input required value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.50" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
            <label><span className="label-mono">Port</span><input type="number" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
          </> : <>
            <label><span className="label-mono">Agent terminal</span><select required value={form.agent_device_id} onChange={e => setForm({ ...form, agent_device_id: e.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"><option value="">Choose terminal…</option>{data.devices.map(device => <option key={device.id} value={device.id}>{device.name} ({device.device_type || 'POS'})</option>)}</select></label>
            <label><span className="label-mono">USB vendor ID</span><input type="number" value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })} placeholder="Detected on terminal" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
            <label><span className="label-mono">USB product ID</span><input type="number" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} placeholder="Detected on terminal" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
            <label><span className="label-mono">Agent LAN IP</span><input value={form.agent_host} onChange={e => setForm({ ...form, agent_host: e.target.value })} placeholder="Auto-detected on terminal" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
          </>}
        </div>
        <button disabled={saving || !form.target_id} className="mt-4 rounded-lg bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Add path'}</button>
      </form>
      <p className="mt-4 text-xs text-dash-tertiary">Internet can be down while Ethernet printing still works if the local switch/AP and printer remain powered. USB protects against the printer Ethernet path failing; it does not protect against printer power, paper, or mechanical failure.</p>

      <PrinterEndpointEditModal
        restaurantId={restaurantId}
        endpoint={editingEndpoint}
        onClose={() => setEditingEndpoint(null)}
        onSaved={load}
      />
    </div>
  )
}
