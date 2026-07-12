import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CheckCircle2, Printer, ReceiptText, Route, Search } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { fetchPosApi } from '../../shared/api/posClient'
import { fetchWithSupabaseAuth } from '../../shared/query'
import MenuPanel from '../MenuPanel'

const DEFAULT_CONFIG = {
  receipt_detail: 'clean',
  customer: {
    header_message: '', footer_message: '', show_server: true, show_table: true,
    show_check_number: true, show_guest_count: true,
    suggested_tips: { enabled: false, percentages: [18, 20, 22], basis: 'subtotal', placement: 'bottom', show_amounts: true },
  },
  kitchen: {
    size: 'standard', print_modifiers: true, print_prices: false,
    print_seats: true, combine_identical: true, item_name_mode: 'alias',
    modifier_name_mode: 'alias', modifier_color: 'black',
  },
  aliases: { items: {}, modifiers: {} },
  stations: {},
}

const clone = value => JSON.parse(JSON.stringify(value))
const sectionFromHash = hash => ['overview', 'routing', 'receipts'].includes(hash.replace('#', '')) ? hash.replace('#', '') : 'overview'

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-white/10 py-3 text-sm last:border-0">
      <span className="text-dash-secondary">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-1 transition ${checked ? 'bg-dash-gold' : 'bg-white/15'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-dash-cream outline-none focus:border-dash-gold/60">
        {children}
      </select>
    </label>
  )
}

export default function PrintingRoutingPage({ restaurantId }) {
  const location = useLocation()
  const section = sectionFromHash(location.hash)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [routing, setRouting] = useState({ stations: [], targets: [] })
  const [catalog, setCatalog] = useState([])
  const [scope, setScope] = useState('whole')
  const [output, setOutput] = useState('kitchen_ticket')
  const [customerVariant, setCustomerVariant] = useState('open_check')
  const [preview, setPreview] = useState('Loading preview…')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const previewRequestRef = useRef(0)

  useEffect(() => {
    let current = true
    const load = async () => {
      setLoading(true)
      try {
        const [printing, routes, itemsResult, modifiersResult] = await Promise.all([
          fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config`),
          fetchWithSupabaseAuth(`/restaurants/${restaurantId}/kitchen-routing`),
          supabase.from('menu_items').select('id,name,category').eq('restaurant_id', restaurantId).is('archived_at', null).order('name'),
          supabase.from('menu_modifiers').select('id,name,group_name').eq('restaurant_id', restaurantId).is('archived_at', null).order('name'),
        ])
        if (!current) return
        if (itemsResult.error) throw itemsResult.error
        if (modifiersResult.error) throw modifiersResult.error
        setConfig({
          ...clone(DEFAULT_CONFIG), ...printing,
          customer: {
            ...clone(DEFAULT_CONFIG.customer), ...(printing.customer || {}),
            suggested_tips: { ...clone(DEFAULT_CONFIG.customer.suggested_tips), ...(printing.customer?.suggested_tips || {}) },
          },
        })
        setRouting(routes || { stations: [], targets: [] })
        setCatalog([
          ...(itemsResult.data || []).map(row => ({ ...row, kind: 'items', type: 'Item' })),
          ...(modifiersResult.data || []).map(row => ({ ...row, kind: 'modifiers', type: 'Modifier', category: row.group_name })),
        ])
      } catch (err) {
        setError(err?.message || 'Could not load printing configuration')
      } finally {
        if (current) setLoading(false)
      }
    }
    void load()
    return () => { current = false }
  }, [restaurantId])

  useEffect(() => {
    if (loading || section === 'routing') return undefined
    const requestId = ++previewRequestRef.current
    const controller = new AbortController()
    setPreview('Rendering preview…')
    const timer = setTimeout(async () => {
      try {
        const result = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config/preview`, {
          method: 'POST',
          body: JSON.stringify({ output, customer_variant: customerVariant, station_id: scope === 'whole' ? null : scope, config }),
          signal: controller.signal,
          cache: 'no-store',
        })
        if (result.renderer_version !== 'printing-v3') throw new Error('Receipt renderer is updating. Refresh this page in a moment.')
        if (requestId === previewRequestRef.current) setPreview(result.preview || 'No preview available')
      } catch (err) {
        if (err?.name !== 'AbortError' && requestId === previewRequestRef.current) {
          setPreview(err?.message || 'Preview unavailable')
        }
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [config, customerVariant, loading, output, restaurantId, scope, section])

  const effectiveKitchen = useMemo(() => ({
    ...config.kitchen,
    ...(scope === 'whole' ? {} : config.stations?.[scope]?.kitchen || {}),
  }), [config, scope])

  const effectiveAliases = kind => ({
    ...(config.aliases?.[kind] || {}),
    ...(scope === 'whole' ? {} : config.stations?.[scope]?.aliases?.[kind] || {}),
  })

  const patchKitchen = patch => setConfig(current => {
    const next = clone(current)
    if (scope === 'whole') next.kitchen = { ...next.kitchen, ...patch }
    else {
      next.stations ||= {}
      next.stations[scope] ||= { kitchen: {}, aliases: { items: {}, modifiers: {} } }
      next.stations[scope].kitchen = { ...next.stations[scope].kitchen, ...patch }
    }
    return next
  })

  const patchCustomer = (patch, tipPatch = null) => setConfig(current => ({
    ...current,
    customer: {
      ...clone(DEFAULT_CONFIG.customer), ...(current.customer || {}), ...patch,
      suggested_tips: {
        ...clone(DEFAULT_CONFIG.customer.suggested_tips), ...(current.customer?.suggested_tips || {}), ...(tipPatch || {}),
      },
    },
  }))

  const setTipPercentage = (index, value) => {
    const percentages = [...(config.customer?.suggested_tips?.percentages || [18, 20, 22])]
    percentages[index] = value
    patchCustomer({}, { percentages })
  }

  const removeTipPercentage = index => {
    const percentages = (config.customer?.suggested_tips?.percentages || []).filter((_, position) => position !== index)
    if (percentages.length) patchCustomer({}, { percentages })
  }

  const setAlias = (kind, id, value) => setConfig(current => {
    const next = clone(current)
    const alias = value.replace(/\s+/g, ' ').slice(0, 40)
    if (scope === 'whole') {
      next.aliases ||= { items: {}, modifiers: {} }
      next.aliases[kind] ||= {}
      if (alias) next.aliases[kind][id] = alias
      else delete next.aliases[kind][id]
    } else {
      next.stations ||= {}
      next.stations[scope] ||= { kitchen: {}, aliases: { items: {}, modifiers: {} } }
      next.stations[scope].aliases ||= { items: {}, modifiers: {} }
      next.stations[scope].aliases[kind] ||= {}
      if (alias) next.stations[scope].aliases[kind][id] = alias
      else delete next.stations[scope].aliases[kind][id]
    }
    return next
  })

  const save = async () => {
    setSaving(true); setError(''); setMessage('')
    try {
      const saved = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config`, { method: 'PUT', body: JSON.stringify(config) })
      setConfig(saved)
      setMessage('Printing configuration saved and active on POS print jobs.')
    } catch (err) {
      setError(err?.message || 'Could not save printing configuration')
    } finally { setSaving(false) }
  }

  if (section === 'routing') return <MenuPanel restaurantId={restaurantId} initialTab="printing" onlyTab="printing" />

  const filtered = catalog.filter(row => `${row.name} ${row.category || ''} ${row.type}`.toLowerCase().includes(search.trim().toLowerCase()))
  const stations = (routing.stations || []).filter(station => station.is_active !== false)

  return (
    <div className="space-y-5">
      <div>
        <p className="label-mono">Printing & Routing</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{section === 'overview' ? 'Overview' : 'Receipts & Tickets'}</h1>
        <p className="mt-2 max-w-3xl text-sm text-dash-secondary">Control what prints without changing the full names staff and guests see in the POS.</p>
      </div>
      {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div>}

      {section === 'overview' && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [Route, 'Stations', `${stations.length} active`],
            [Printer, 'Printer targets', `${(routing.targets || []).filter(target => target.is_active !== false).length} active`],
            [ReceiptText, 'Customer receipt', config.receipt_detail === 'full' ? 'Full detail' : 'Clean detail'],
          ].map(([Icon, label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><Icon className="h-5 w-5 text-dash-gold" /><p className="mt-4 label-mono">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Output" value={output} onChange={setOutput}><option value="kitchen_ticket">Kitchen ticket</option><option value="customer_receipt">Customer receipt</option></Select>
              {output === 'kitchen_ticket' && <Select label="Apply to" value={scope} onChange={setScope}><option value="whole">Whole Kitchen</option>{stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</Select>}
              {output === 'customer_receipt' && <Select label="Preview state" value={customerVariant} onChange={setCustomerVariant}><option value="open_check">Open check</option><option value="paid_cash">Paid with cash</option><option value="paid_card">Paid with card</option></Select>}
            </div>
          </div>

          {output === 'customer_receipt' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Customer receipt detail</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Clean hides $0 items and ordinary free modifiers. Full prints every line.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">{['clean', 'full'].map(value => <button key={value} onClick={() => setConfig(current => ({ ...current, receipt_detail: value }))} className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize ${config.receipt_detail === value ? 'border-dash-gold bg-dash-gold/15 text-dash-gold' : 'border-white/10 text-dash-secondary'}`}>{value}</button>)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Suggested tips</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Print percentage choices on the open check. Paid receipts never ask for another tip.</p>
                <div className="mt-3"><Toggle label="Print suggested tips" checked={config.customer?.suggested_tips?.enabled ?? false} onChange={value => patchCustomer({}, { enabled: value })} /></div>
                {config.customer?.suggested_tips?.enabled && <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Select label="Calculate from" value={config.customer.suggested_tips.basis} onChange={value => patchCustomer({}, { basis: value })}><option value="subtotal">Pre-tax subtotal</option><option value="total">Check total</option></Select>
                    <Select label="Print location" value={config.customer.suggested_tips.placement} onChange={value => patchCustomer({}, { placement: value })}><option value="bottom">Bottom of check</option><option value="below_total">Directly below total</option></Select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3"><span className="label-mono">Tip options</span>{config.customer.suggested_tips.percentages.length < 4 && <button type="button" onClick={() => patchCustomer({}, { percentages: [...config.customer.suggested_tips.percentages, 25] })} className="text-xs font-semibold text-dash-gold">+ Add option</button>}</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {config.customer.suggested_tips.percentages.map((percentage, index) => <div key={index} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"><input type="number" min="1" max="50" step="0.5" value={percentage} onChange={event => setTipPercentage(index, event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><span className="text-sm text-dash-tertiary">%</span>{config.customer.suggested_tips.percentages.length > 1 && <button type="button" onClick={() => removeTipPercentage(index)} className="text-xs text-dash-tertiary hover:text-red-300">Remove</button>}</div>)}
                    </div>
                  </div>
                  <Toggle label="Show calculated dollar amounts" checked={config.customer.suggested_tips.show_amounts} onChange={value => patchCustomer({}, { show_amounts: value })} />
                </div>}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Receipt messages</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Keep these short so the receipt stays readable.</p>
                <label className="mt-4 block"><span className="label-mono">Header message</span><input maxLength={120} value={config.customer?.header_message || ''} onChange={event => patchCustomer({ header_message: event.target.value })} placeholder="Welcome, event name, or brief notice" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
                <label className="mt-4 block"><span className="label-mono">Footer message</span><textarea maxLength={240} rows={3} value={config.customer?.footer_message || ''} onChange={event => patchCustomer({ footer_message: event.target.value })} placeholder="Thank you, return policy, or social message" className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Check information</h2>
                <div className="mt-3"><Toggle label="Show table or tab name" checked={config.customer?.show_table ?? true} onChange={value => patchCustomer({ show_table: value })} /><Toggle label="Show check number" checked={config.customer?.show_check_number ?? true} onChange={value => patchCustomer({ show_check_number: value })} /><Toggle label="Show server name" checked={config.customer?.show_server ?? true} onChange={value => patchCustomer({ show_server: value })} /><Toggle label="Show guest count" checked={config.customer?.show_guest_count ?? true} onChange={value => patchCustomer({ show_guest_count: value })} /></div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Ticket detail</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Select label="Size" value={effectiveKitchen.size} onChange={value => patchKitchen({ size: value })}><option value="compact">Compact</option><option value="standard">Standard</option><option value="large">Large</option></Select>
                  <Select label="Item names" value={effectiveKitchen.item_name_mode} onChange={value => patchKitchen({ item_name_mode: value })}><option value="alias">Use aliases</option><option value="full">Use full names</option></Select>
                  <Select label="Modifier names" value={effectiveKitchen.modifier_name_mode} onChange={value => patchKitchen({ modifier_name_mode: value })}><option value="alias">Use aliases</option><option value="full">Use full names</option></Select>
                </div>
                <div className="mt-4"><Select label="Modifier color" value={effectiveKitchen.modifier_color} onChange={value => patchKitchen({ modifier_color: value })}><option value="black">Black</option><option value="red">Red on compatible impact printers</option></Select></div>
                <div className="mt-4"><Toggle label="Print modifiers" checked={effectiveKitchen.print_modifiers} onChange={value => patchKitchen({ print_modifiers: value })} /><Toggle label="Print prices" checked={effectiveKitchen.print_prices} onChange={value => patchKitchen({ print_prices: value })} /><Toggle label="Print seats" checked={effectiveKitchen.print_seats} onChange={value => patchKitchen({ print_seats: value })} /><Toggle label="Combine identical items" checked={effectiveKitchen.combine_identical} onChange={value => patchKitchen({ combine_identical: value })} /></div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Printed names</h2><p className="mt-1 text-sm text-dash-tertiary">Full POS names remain unchanged.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-dash-tertiary" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search items or modifiers" className="rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm outline-none" /></div></div>
                <div className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border border-white/10">
                  {filtered.map(row => { const aliases = effectiveAliases(row.kind); const inherited = config.aliases?.[row.kind]?.[row.id]; return <div key={`${row.kind}-${row.id}`} className="grid gap-2 border-b border-white/10 p-3 last:border-0 md:grid-cols-[1.2fr_.9fr_.5fr] md:items-center"><div><p className="text-sm font-medium text-dash-cream">{row.name}</p><p className="text-xs text-dash-tertiary">{row.type}{row.category ? ` · ${row.category}` : ''}</p></div><input value={aliases[row.id] || ''} onChange={event => setAlias(row.kind, row.id, event.target.value)} placeholder={scope !== 'whole' && inherited ? `Inherits ${inherited}` : 'Uses full name'} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-dash-gold/60" /><span className="text-xs text-dash-tertiary">{scope === 'whole' ? 'Whole Kitchen' : aliases[row.id] && aliases[row.id] !== inherited ? 'Station override' : 'Inherited'}</span></div> })}
                </div>
              </div>
            </>
          )}
          <button onClick={save} disabled={saving} className="rounded-xl bg-dash-gold px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>

        <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.035] p-5 xl:sticky xl:top-20">
          <div className="flex items-center justify-between"><div><p className="label-mono">Live preview</p><h2 className="mt-1 text-lg font-semibold">{output === 'kitchen_ticket' ? 'Kitchen ticket' : 'Customer receipt'}</h2></div><span className="inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Real renderer</span></div>
          <div className="mx-auto mt-5 max-w-[430px] bg-[#fffdf6] px-7 py-8 text-black shadow-2xl">
            <pre className={`whitespace-pre-wrap font-mono leading-relaxed ${effectiveKitchen.size === 'compact' ? 'text-xs' : effectiveKitchen.size === 'large' ? 'text-base' : 'text-sm'}`}>{preview.split('\n').map((line, index) => <span key={index} className={output === 'kitchen_ticket' && effectiveKitchen.modifier_color === 'red' && /^\s*\+/.test(line) ? 'text-red-700' : ''}>{line}{'\n'}</span>)}</pre>
          </div>
          <p className="mt-4 text-center text-xs text-dash-tertiary">Uses live menu names and the same ReceiptLine renderer as the printer.</p>
        </div>
      </div>
    </div>
  )
}
