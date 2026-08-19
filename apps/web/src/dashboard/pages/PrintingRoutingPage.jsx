import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, Printer, ReceiptText, Route, Search } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { fetchPosApi } from '../../shared/api/posClient'
import MenuPanel from '../MenuPanel'
import ResilientPrintingCard from '../components/printing/ResilientPrintingCard'
import ProductionWorkflowCard from '../components/printing/ProductionWorkflowCard'
import HardwareChainGuide from '../components/printing/HardwareChainGuide'
import TicketTopBuilder from '../components/printing/TicketTopBuilder'
import { TICKET_TOP_STARTER, ticketTopFieldPresentation } from '../components/printing/ticketTopPolicy'
import {
  isKitchenPreviewItemLine,
  isKitchenPreviewLocationLine,
  isKitchenPreviewModifierLine,
} from '../components/printing/ticketPreviewPolicy'

const DEFAULT_CONFIG = {
  auto_print_after_payment: true,
  receipt_detail: 'full',
  customer: {
    size: 'medium',
    show_restaurant_name: true, restaurant_name: '', restaurant_name_size: 'standard',
    show_address: true, address_lines: [], address_size: 'standard',
    show_phone: true, phone: '', phone_size: 'standard',
    header_message: '', footer_message: '', show_server: true, show_table: true, table_size: 'standard',
    show_tab_name: false, show_check_number: true, check_number_size: 'standard', show_date_time: true, show_guest_count: true,
    suggested_tips: { enabled: false, percentages: [18, 20, 22], basis: 'subtotal', placement: 'bottom', show_amounts: true },
    signed_tip_slip: { external_card: false },
  },
  report: { size: 'medium' },
  kitchen: {
    size: 'easy_read', print_modifiers: true, print_prices: false,
    print_seats: true, combine_identical: true, item_bold: true, item_name_mode: 'alias',
    modifier_name_mode: 'alias', modifier_size: 'large', modifier_color: 'black', modifier_bold: true,
    modifier_marker: 'indent', line_density: 'tight',
    note_size: 'large', note_color: 'red', note_bold: true,
    check_number_format: 'chk', time_format: 'meridiem', seat_format: 'short',
    note_style: 'stars', item_separator: 'dashes',
  },
  aliases: { items: {}, modifiers: {} },
  stations: {},
}

const clone = value => JSON.parse(JSON.stringify(value))
const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right)

// The printing endpoint intentionally accepts a complete document. Rebase only
// edits made since this page loaded onto a fresh canonical read so a manager
// cannot overwrite a concurrent POS or Back Office change by saving stale UI.
function mergeChangedPrintingValues(baseline, draft, fresh) {
  if (jsonEqual(baseline, draft)) return fresh === undefined ? undefined : clone(fresh)
  const baselineObject = baseline && typeof baseline === 'object' && !Array.isArray(baseline)
  const draftObject = draft && typeof draft === 'object' && !Array.isArray(draft)
  if (!baselineObject || !draftObject) return draft === undefined ? undefined : clone(draft)
  const result = fresh && typeof fresh === 'object' && !Array.isArray(fresh) ? clone(fresh) : {}
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(draft)])) {
    if (!(key in draft)) delete result[key]
    else if (!(key in baseline)) result[key] = clone(draft[key])
    else if (!jsonEqual(baseline[key], draft[key])) {
      result[key] = mergeChangedPrintingValues(baseline[key], draft[key], result[key])
    }
  }
  return result
}
const sectionFromHash = hash => ['overview', 'routing', 'receipts'].includes(hash.replace('#', '')) ? hash.replace('#', '') : 'overview'
const PRICING_PROGRAM_LABELS = {
  standard: 'Standard pricing receipt',
  dual_pricing_posted_electronic: 'Dual posted prices · Cash / Card columns',
  credit_surcharge: 'Credit-card surcharge · separate surcharge row',
  cash_discount: 'Cash discount · standard price minus discount',
}

const MEMO_FIELDS = new Set(['check_memo', 'check_memo_label', 'check_memo_value'])
const KITCHEN_METHOD_LABELS = { dine_in: 'DINE IN', togo: 'TO GO', delivery: 'DELIVERY' }

function memoPresentation(rows) {
  for (const row of rows || []) {
    if (row?.type === 'field' && MEMO_FIELDS.has(row.field)) return row
    if (row?.type !== 'pair') continue
    for (const side of [row.left, row.right]) {
      const parts = Array.isArray(side?.parts) ? side.parts : [side]
      if (parts.some(part => MEMO_FIELDS.has(part?.field))) return { ...row, ...side, pair: true }
    }
  }
  return { align: 'left', size: 'standard', bold: true, color: 'red' }
}

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
  const [savedAutoPrintAfterPayment, setSavedAutoPrintAfterPayment] = useState(true)
  const [savedExternalCardSignedSlip, setSavedExternalCardSignedSlip] = useState(false)
  const [savedKitchenPresentation, setSavedKitchenPresentation] = useState({ modifier_marker: 'indent', line_density: 'tight' })
  const [receiptPolicyReason, setReceiptPolicyReason] = useState('')
  const [routing, setRouting] = useState({ stations: [], targets: [] })
  const [catalog, setCatalog] = useState([])
  const [scope, setScope] = useState('whole')
  const [output, setOutput] = useState('kitchen_ticket')
  const [customerVariant, setCustomerVariant] = useState('open_check')
  const [kitchenVariant, setKitchenVariant] = useState('dine_in')
  const [kitchenMemo, setKitchenMemo] = useState('OK')
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [previewCapabilities, setPreviewCapabilities] = useState(null)
  const [dirtyTargetIds, setDirtyTargetIds] = useState(() => new Set())
  const [preview, setPreview] = useState('Loading preview…')
  const [previewStatus, setPreviewStatus] = useState('loading')
  const [previewPricingProgram, setPreviewPricingProgram] = useState('standard')
  const [previewPricingWarnings, setPreviewPricingWarnings] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadedRestaurantId, setLoadedRestaurantId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const previewRequestRef = useRef(0)
  const loadedConfigRef = useRef(null)

  useEffect(() => {
    let current = true
    const load = async () => {
      setLoading(true)
      try {
        const [printing, routes, itemsResult, modifiersResult] = await Promise.all([
          // printing-config 404s until the POS receipt-config backend build is
          // deployed — fall back to defaults so routing/aliases still work.
          fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config`)
            .catch(err => {
              if (err?.status === 404) return null
              throw err
            }),
          // Printer IDs, usage, and capabilities must come from the same POS
          // backend that validates and renders the preview. The general back
          // office API still exposes legacy pos_routing_targets IDs, which are
          // not valid kitchen_output_targets IDs.
          fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing`),
          supabase.from('menu_items').select('id,name,category').eq('restaurant_id', restaurantId).is('archived_at', null).order('name'),
          supabase.from('menu_modifiers').select('id,name,group_name').eq('restaurant_id', restaurantId).is('archived_at', null).order('name'),
        ])
        if (!current) return
        if (itemsResult.error) throw itemsResult.error
        if (modifiersResult.error) throw modifiersResult.error
        const mergedPrinting = {
          ...clone(DEFAULT_CONFIG), ...(printing || {}),
          customer: {
            ...clone(DEFAULT_CONFIG.customer), ...(printing?.customer || {}),
            suggested_tips: { ...clone(DEFAULT_CONFIG.customer.suggested_tips), ...(printing?.customer?.suggested_tips || {}) },
          },
          report: { ...clone(DEFAULT_CONFIG.report), ...(printing?.report || {}) },
          kitchen: { ...clone(DEFAULT_CONFIG.kitchen), ...(printing?.kitchen || {}) },
        }
        setConfig(mergedPrinting)
        loadedConfigRef.current = clone(mergedPrinting)
        setSavedAutoPrintAfterPayment(mergedPrinting.auto_print_after_payment !== false)
        setSavedExternalCardSignedSlip(mergedPrinting.customer?.signed_tip_slip?.external_card === true)
        setSavedKitchenPresentation({
          modifier_marker: mergedPrinting.kitchen?.modifier_marker ?? 'indent',
          line_density: mergedPrinting.kitchen?.line_density ?? 'tight',
        })
        setReceiptPolicyReason('')
        setLoadedRestaurantId(String(restaurantId))
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

  const eligibleTargets = useMemo(() => (routing.targets || []).filter(target => {
    if (target.is_active === false || target.target_type !== 'printer') return false
    const usage = target.usage || 'kitchen'
    return output === 'kitchen_ticket' ? ['kitchen', 'both'].includes(usage) : ['receipt', 'both'].includes(usage)
  }), [output, routing.targets])

  useEffect(() => {
    if (!eligibleTargets.some(target => String(target.id) === selectedTargetId)) {
      setSelectedTargetId(String(eligibleTargets[0]?.id || ''))
    }
  }, [eligibleTargets, selectedTargetId])

  const selectedTarget = eligibleTargets.find(target => String(target.id) === selectedTargetId) || null

  useEffect(() => {
    setPreviewCapabilities(selectedTarget?.printer_capabilities || null)
  }, [output, selectedTargetId])

  useEffect(() => {
    if (loading || section === 'routing') return undefined
    const requestId = ++previewRequestRef.current
    const controller = new AbortController()
    setPreview('Rendering preview…')
    setPreviewStatus('loading')
    setPreviewPricingWarnings([])
    const timer = setTimeout(async () => {
      try {
        const result = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config/preview`, {
          method: 'POST',
          body: JSON.stringify({
            output,
            customer_variant: customerVariant,
            kitchen_variant: kitchenVariant,
            kitchen_memo: kitchenMemo.trim() || null,
            station_id: scope === 'whole' ? null : scope,
            target_id: selectedTargetId || null,
            paper_width_mm: selectedTarget?.config?.paper_width_mm || null,
            config,
          }),
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!['printing-v5', 'printing-v6', 'printing-v7', 'printing-v8', 'printing-v9'].includes(result.renderer_version)) {
          throw new Error('Receipt preview version is not supported. Refresh this page after the POS backend finishes updating.')
        }
        if (requestId === previewRequestRef.current) {
          setPreview(result.preview || 'No preview available')
          setPreviewCapabilities(result.printer_capabilities || null)
          setPreviewPricingProgram(result.pricing_program || 'standard')
          setPreviewPricingWarnings(result.pricing_warnings || [])
          setPreviewStatus('ready')
        }
      } catch (err) {
        if (err?.name !== 'AbortError' && requestId === previewRequestRef.current) {
          setPreview(err?.message || 'Preview unavailable')
          setPreviewStatus('error')
        }
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [config, customerVariant, kitchenMemo, kitchenVariant, loading, output, restaurantId, scope, section, selectedTarget, selectedTargetId])

  const effectiveKitchen = useMemo(() => ({
    ...config.kitchen,
    ...(scope === 'whole' ? {} : config.stations?.[scope]?.kitchen || {}),
  }), [config, scope])
  const stationKitchen = scope === 'whole' ? null : config.stations?.[scope]?.kitchen
  const ticketTopConfigured = Array.isArray(effectiveKitchen.header) || Array.isArray(effectiveKitchen.info)
  const ticketTopOverridden = scope === 'whole'
    ? ticketTopConfigured
    : Array.isArray(stationKitchen?.header) || Array.isArray(stationKitchen?.info)
  const memoStyle = useMemo(() => {
    const rows = ticketTopConfigured
      ? [...(effectiveKitchen.header || []), ...(effectiveKitchen.info || [])]
      : [...TICKET_TOP_STARTER.header, ...TICKET_TOP_STARTER.info]
    return memoPresentation(rows)
  }, [effectiveKitchen, ticketTopConfigured])
  const methodStyle = useMemo(() => {
    const rows = ticketTopConfigured
      ? [...(effectiveKitchen.header || []), ...(effectiveKitchen.info || [])]
      : [...TICKET_TOP_STARTER.header, ...TICKET_TOP_STARTER.info]
    return ticketTopFieldPresentation(rows, 'order_type') || {}
  }, [effectiveKitchen, ticketTopConfigured])
  const locationStyle = useMemo(() => {
    const rows = ticketTopConfigured
      ? [...(effectiveKitchen.header || []), ...(effectiveKitchen.info || [])]
      : [...TICKET_TOP_STARTER.header, ...TICKET_TOP_STARTER.info]
    return ticketTopFieldPresentation(rows, 'location') || {}
  }, [effectiveKitchen, ticketTopConfigured])

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

  // Removes the ticket-top spec so the POS prints the canonical stock top
  // again (station scope falls back to the whole-kitchen spec, if any).
  // patchKitchen can't do this — merging never deletes keys. The counter
  // remounts the builder so it re-reads the post-reset effective rows.
  const [ticketTopResetKey, setTicketTopResetKey] = useState(0)
  const resetTicketTop = () => {
    setConfig(current => {
      const next = clone(current)
      if (scope === 'whole') {
        delete next.kitchen.header
        delete next.kitchen.info
        delete next.kitchen.ticket_top_customized
      } else if (next.stations?.[scope]?.kitchen) {
        delete next.stations[scope].kitchen.header
        delete next.stations[scope].kitchen.info
        delete next.stations[scope].kitchen.ticket_top_customized
      }
      return next
    })
    setTicketTopResetKey(current => current + 1)
  }

  const patchCustomer = (patch, tipPatch = null) => setConfig(current => ({
    ...current,
    customer: {
      ...clone(DEFAULT_CONFIG.customer), ...(current.customer || {}), ...patch,
      suggested_tips: {
        ...clone(DEFAULT_CONFIG.customer.suggested_tips), ...(current.customer?.suggested_tips || {}), ...(tipPatch || {}),
      },
    },
  }))

  const patchReport = patch => setConfig(current => ({
    ...current,
    report: { ...clone(DEFAULT_CONFIG.report), ...(current.report || {}), ...patch },
  }))

  const patchTargetPaperWidth = value => {
    const paperWidth = Number(value)
    setRouting(current => ({
      ...current,
      targets: (current.targets || []).map(target => String(target.id) === selectedTargetId
        ? { ...target, config: { ...(target.config || {}), paper_width_mm: paperWidth } }
        : target),
    }))
    setDirtyTargetIds(current => new Set([...current, selectedTargetId]))
  }

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
    const autoPrintChanged = (config.auto_print_after_payment !== false) !== savedAutoPrintAfterPayment
    const externalSignedSlipChanged = (config.customer?.signed_tip_slip?.external_card === true) !== savedExternalCardSignedSlip
    const kitchenPresentationChanged = (config.kitchen?.modifier_marker ?? 'indent') !== savedKitchenPresentation.modifier_marker
      || (config.kitchen?.line_density ?? 'tight') !== savedKitchenPresentation.line_density
    const auditedBehaviorChanged = autoPrintChanged || externalSignedSlipChanged || kitchenPresentationChanged
    const reason = receiptPolicyReason.trim()
    setError(''); setMessage('')
    if (auditedBehaviorChanged && reason.length < 2) {
      setError('Enter a reason for changing receipt or kitchen-ticket behavior.')
      return
    }
    setSaving(true)
    try {
      const fresh = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config`, { cache: 'no-store' })
      const rebasedConfig = mergeChangedPrintingValues(loadedConfigRef.current || fresh, config, fresh)
      const saved = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/printing-config`, {
        method: 'PUT',
        body: JSON.stringify({ ...rebasedConfig, ...(auditedBehaviorChanged ? { change_reason: reason } : {}) }),
      })
      setConfig(saved)
      loadedConfigRef.current = clone(saved)
      setSavedAutoPrintAfterPayment(saved.auto_print_after_payment !== false)
      setSavedExternalCardSignedSlip(saved.customer?.signed_tip_slip?.external_card === true)
      setSavedKitchenPresentation({
        modifier_marker: saved.kitchen?.modifier_marker ?? 'indent',
        line_density: saved.kitchen?.line_density ?? 'tight',
      })
      setReceiptPolicyReason('')
      for (const targetId of dirtyTargetIds) {
        const target = (routing.targets || []).find(candidate => String(candidate.id) === String(targetId))
        if (!target) continue
        await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing/targets/${targetId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: target.name,
            target_type: target.target_type,
            connection_type: target.connection_type,
            config: target.config || {},
            is_active: target.is_active !== false,
            usage: target.usage || 'kitchen',
            pos_device_id: target.pos_device_id || null,
          }),
        })
      }
      if (dirtyTargetIds.size) {
        const routes = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/kitchen-routing`)
        setRouting(routes || { stations: [], targets: [] })
        setDirtyTargetIds(new Set())
      }
      setMessage('Printing configuration saved and active on POS print jobs.')
    } catch (err) {
      setError(err?.message || 'Could not save printing configuration')
    } finally { setSaving(false) }
  }

  if (section === 'routing') return <div className="space-y-5"><ProductionWorkflowCard restaurantId={restaurantId} /><MenuPanel restaurantId={restaurantId} initialTab="printing" onlyTab="printing" /></div>

  const filtered = catalog.filter(row => `${row.name} ${row.category || ''} ${row.type}`.toLowerCase().includes(search.trim().toLowerCase()))
  const stations = (routing.stations || []).filter(station => station.is_active !== false)
  const displayedCapabilities = previewCapabilities || selectedTarget?.printer_capabilities || null
  const supportsRed = displayedCapabilities ? displayedCapabilities.family === 'impact' : null
  const paperWidthOptions = displayedCapabilities?.paper_width_options || []
  const previewTitle = output === 'kitchen_ticket' ? 'Kitchen ticket' : output === 'server_report' ? 'Server report' : 'Customer receipt'
  const previewSize = output === 'kitchen_ticket' ? effectiveKitchen.size : output === 'server_report' ? config.report?.size : config.customer?.size
  const previewLines = preview.split('\n')
  const firstPreviewItemIndex = previewLines.findIndex(line => /^\d+(?:\.\d+)?\s{2}\S/.test(line))
  const memoPreviewValues = kitchenMemo.split(/\r?\n/).map(line => line.trim()).filter(Boolean)

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
        <><div className="grid gap-4 md:grid-cols-3">
          {[
            [Route, 'Stations', `${stations.length} active`],
            [Printer, 'Printer targets', `${(routing.targets || []).filter(target => target.is_active !== false).length} active`],
            [ReceiptText, 'Customer receipt', config.receipt_detail === 'full' ? 'Full detail' : 'Clean detail'],
          ].map(([Icon, label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><Icon className="h-5 w-5 text-dash-gold" /><p className="mt-4 label-mono">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}
        </div><HardwareChainGuide /><ResilientPrintingCard restaurantId={restaurantId} /></>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-4">
          {section === 'receipts' && (
            <div className="rounded-2xl border border-dash-gold/30 bg-dash-gold/[0.07] p-5">
              <p className="label-mono">Paid receipt behavior</p>
              <h2 className="mt-2 text-lg font-semibold">Automatic receipt after payment</h2>
              <p className="mt-1 text-sm text-dash-tertiary">This restaurant-wide policy is shared with every POS station. It is enabled by default.</p>
              <div className="mt-3"><Toggle label="Print automatically when payment succeeds" checked={config.auto_print_after_payment !== false} onChange={value => setConfig(current => ({ ...current, auto_print_after_payment: value }))} /></div>
              <p className="mt-3 text-xs text-dash-tertiary">When off, payment still completes normally and staff can print from Payment Complete or a closed check at any time.</p>
              {(config.auto_print_after_payment !== false) !== savedAutoPrintAfterPayment && (
                <label className="mt-4 block">
                  <span className="label-mono">Reason for change</span>
                  <input maxLength={300} value={receiptPolicyReason} onChange={event => setReceiptPolicyReason(event.target.value)} placeholder="Example: Guests prefer digital receipts" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" />
                  <span className="mt-2 block text-xs text-dash-tertiary">Saved in the printing configuration audit log.</span>
                </label>
              )}
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Output" value={output} onChange={setOutput}><option value="kitchen_ticket">Kitchen ticket</option><option value="customer_receipt">Customer receipt</option><option value="server_report">Server report</option></Select>
              <Select label="Printer" value={selectedTargetId} onChange={setSelectedTargetId}>
                {!eligibleTargets.length && <option value="">No compatible printer configured</option>}
                {eligibleTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
              </Select>
              {output === 'kitchen_ticket' && <Select label="Apply to" value={scope} onChange={setScope}><option value="whole">Whole Kitchen</option>{stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</Select>}
              {output === 'kitchen_ticket' && <Select label="Preview order method" value={kitchenVariant} onChange={setKitchenVariant}><option value="dine_in">Dine-in</option><option value="togo">To-Go</option><option value="delivery">Delivery</option></Select>}
              {output === 'kitchen_ticket' && <label className="block"><span className="label-mono">Preview check memo</span><input maxLength={240} value={kitchenMemo} onChange={event => setKitchenMemo(event.target.value)} placeholder="Blank previews a ticket with no check memo" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>}
              {output === 'customer_receipt' && <Select label="Preview state" value={customerVariant} onChange={setCustomerVariant}><option value="open_check">Open check</option><option value="paid_cash">Paid with cash</option><option value="paid_card">Paid with credit card</option><option value="paid_debit">Paid with debit / prepaid</option><option value="paid_external">Paid on external card terminal</option></Select>}
            </div>
          </div>

          {output === 'customer_receipt' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dash-gold/30 bg-dash-gold/[0.07] p-5">
                <p className="label-mono">Active pricing receipt</p>
                <h2 className="mt-2 text-lg font-semibold">{PRICING_PROGRAM_LABELS[previewPricingProgram] || PRICING_PROGRAM_LABELS.standard}</h2>
                <p className="mt-1 text-sm text-dash-tertiary">This is chosen from the restaurant's financial pricing mode. Custom wording cannot change the receipt math.</p>
                {previewPricingWarnings.length > 0 && <div className="mt-4 space-y-2">{previewPricingWarnings.map(warning => <div key={warning} className="flex gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{warning}</span></div>)}</div>}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Receipt presentation</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Medium is the readable default. Compact fits more per line; Large increases line height.</p>
                <div className="mt-4"><Select label="Text size" value={config.customer?.size || 'medium'} onChange={value => patchCustomer({ size: value })}><option value="compact">Compact</option><option value="medium">Medium</option><option value="large">Large</option></Select></div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Receipt identity</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Add the restaurant name, up to three address lines, and a phone number at the top.</p>
                <div className="mt-3"><Toggle label="Show restaurant name" checked={config.customer?.show_restaurant_name ?? true} onChange={value => patchCustomer({ show_restaurant_name: value })} /></div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block"><span className="label-mono">Printed restaurant name</span><input maxLength={80} value={config.customer?.restaurant_name || ''} onChange={event => patchCustomer({ restaurant_name: event.target.value })} placeholder="Blank uses the restaurant record" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
                  <Select label="Name size" value={config.customer?.restaurant_name_size || 'standard'} onChange={value => patchCustomer({ restaurant_name_size: value })}><option value="standard">Standard · bold</option><option value="large">Large · stretched</option></Select>
                </div>
                <div className="mt-3"><Toggle label="Show address" checked={config.customer?.show_address ?? true} onChange={value => patchCustomer({ show_address: value })} /></div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block"><span className="label-mono">Address override (one line per row)</span><textarea maxLength={242} rows={3} value={(config.customer?.address_lines || []).join('\n')} onChange={event => patchCustomer({ address_lines: event.target.value.split(/\r?\n/).slice(0, 3) })} placeholder="Blank uses the restaurant record" className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
                  <Select label="Address size" value={config.customer?.address_size || 'standard'} onChange={value => patchCustomer({ address_size: value })}><option value="standard">Standard</option><option value="large">Large</option></Select>
                </div>
                <div className="mt-3"><Toggle label="Show phone number" checked={config.customer?.show_phone ?? true} onChange={value => patchCustomer({ show_phone: value })} /></div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block"><span className="label-mono">Phone override</span><input maxLength={40} value={config.customer?.phone || ''} onChange={event => patchCustomer({ phone: event.target.value })} placeholder="Blank uses the restaurant record" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
                  <Select label="Phone size" value={config.customer?.phone_size || 'standard'} onChange={value => patchCustomer({ phone_size: value })}><option value="standard">Standard</option><option value="large">Large</option></Select>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Customer receipt detail</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Keep complimentary items visible for loss prevention, or hide ordinary $0 lines for a shorter receipt. Fully discounted paid items and their discounts remain visible.</p>
                <div className="mt-3"><Toggle label="Show $0 items on customer receipts" checked={config.receipt_detail !== 'clean'} onChange={checked => setConfig(current => ({ ...current, receipt_detail: checked ? 'full' : 'clean' }))} /></div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Suggested tips</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Print percentage choices on the open check. The external-card option below is a separate handwritten tip workflow.</p>
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
                <div className="mt-4 border-t border-white/10 pt-4">
                  <Toggle
                    label="Print Tip, Total & Signature lines for external card payments"
                    checked={config.customer?.signed_tip_slip?.external_card === true}
                    onChange={value => patchCustomer({
                      signed_tip_slip: {
                        ...(config.customer?.signed_tip_slip || {}),
                        external_card: value,
                      },
                    })}
                  />
                  <p className="mt-2 text-xs text-dash-tertiary">Integrated Shire card payments already use their standard signed merchant slip. Enable this only when the external terminal does not print its own slip. A recorded tip or finalized No Tip decision never prints blank tip lines.</p>
                  {(config.customer?.signed_tip_slip?.external_card === true) !== savedExternalCardSignedSlip && (config.auto_print_after_payment !== false) === savedAutoPrintAfterPayment && (
                    <label className="mt-4 block">
                      <span className="label-mono">Reason for change</span>
                      <input maxLength={300} value={receiptPolicyReason} onChange={event => setReceiptPolicyReason(event.target.value)} placeholder="Example: External terminal does not print a signed slip" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" />
                      <span className="mt-2 block text-xs text-dash-tertiary">Saved in the printing configuration audit log.</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Receipt messages</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Keep these short so the receipt stays readable.</p>
                <label className="mt-4 block"><span className="label-mono">Header message</span><input maxLength={120} value={config.customer?.header_message || ''} onChange={event => patchCustomer({ header_message: event.target.value })} placeholder="Welcome, event name, or brief notice" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
                <label className="mt-4 block"><span className="label-mono">Footer message</span><textarea maxLength={240} rows={3} value={config.customer?.footer_message || ''} onChange={event => patchCustomer({ footer_message: event.target.value })} placeholder="Thank you, return policy, or social message" className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" /></label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Check information</h2>
                <p className="mt-1 text-sm text-dash-tertiary">Table numbers and bar-tab names are separate so customer-facing tab names remain optional.</p>
                <div className="mt-3"><Toggle label="Show table number" checked={config.customer?.show_table ?? true} onChange={value => patchCustomer({ show_table: value })} />
                  {config.customer?.show_table !== false && <div className="pb-3"><Select label="Table row size" value={config.customer?.table_size || 'standard'} onChange={value => patchCustomer({ table_size: value })}><option value="standard">Standard · inline</option><option value="large">Large · own row</option></Select></div>}
                  <Toggle label="Show bar tab name" checked={config.customer?.show_tab_name ?? false} onChange={value => patchCustomer({ show_tab_name: value })} />
                  <Toggle label="Show check number" checked={config.customer?.show_check_number ?? true} onChange={value => patchCustomer({ show_check_number: value })} />
                  {config.customer?.show_check_number !== false && <div className="pb-3"><Select label="Check number size" value={config.customer?.check_number_size || 'standard'} onChange={value => patchCustomer({ check_number_size: value })}><option value="standard">Standard · inline</option><option value="large">Large · own row</option></Select></div>}
                  <Toggle label="Show date and time" checked={config.customer?.show_date_time ?? true} onChange={value => patchCustomer({ show_date_time: value })} />
                  <Toggle label="Show server name" checked={config.customer?.show_server ?? true} onChange={value => patchCustomer({ show_server: value })} />
                  <Toggle label="Show guest count" checked={config.customer?.show_guest_count ?? true} onChange={value => patchCustomer({ show_guest_count: value })} />
                </div>
              </div>
            </div>
          ) : output === 'server_report' ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="text-lg font-semibold">Server report presentation</h2>
              <p className="mt-1 text-sm text-dash-tertiary">The SERVER REPORT heading stays large. This setting controls the report body and calculated column width.</p>
              <div className="mt-4"><Select label="Body size" value={config.report?.size || 'medium'} onChange={value => patchReport({ size: value })}><option value="compact">Compact</option><option value="medium">Medium</option><option value="large">Large</option></Select></div>
            </div>
          ) : (
            <>
              {loadedRestaurantId === String(restaurantId) ? (
                <TicketTopBuilder
                  key={`${restaurantId}:${scope}:${ticketTopResetKey}`}
                  header={effectiveKitchen.header}
                  info={effectiveKitchen.info}
                  configured={ticketTopConfigured}
                  inherited={scope !== 'whole' && ticketTopConfigured && !ticketTopOverridden}
                  stationScoped={scope !== 'whole'}
                  canReset={ticketTopOverridden}
                  supportsRed={supportsRed}
                  onChange={patch => patchKitchen({ ...patch, ticket_top_customized: true })}
                  onReset={resetTicketTop}
                />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-dash-tertiary">
                  Loading ticket configuration…
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold">Ticket detail</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Select label="Size" value={effectiveKitchen.size} onChange={value => patchKitchen({ size: value })}><option value="compact">Compact</option><option value="standard">Standard</option><option value="easy_read">Easy Read (recommended)</option><option value="large">Large</option></Select>
                  <Select label="Item names" value={effectiveKitchen.item_name_mode} onChange={value => patchKitchen({ item_name_mode: value })}><option value="alias">Use aliases</option><option value="full">Use full names</option></Select>
                  <Select label="Modifier names" value={effectiveKitchen.modifier_name_mode} onChange={value => patchKitchen({ modifier_name_mode: value })}><option value="alias">Use aliases</option><option value="full">Use full names</option></Select>
                </div>
                <div className="mt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select label="Modifier size" value={effectiveKitchen.modifier_size ?? 'large'} onChange={value => patchKitchen({ modifier_size: value })}><option value="standard">Standard</option><option value="large">Large (recommended)</option></Select>
                    <Select label="Note size" value={effectiveKitchen.note_size ?? 'large'} onChange={value => patchKitchen({ note_size: value })}><option value="standard">Standard</option><option value="large">Large (recommended)</option></Select>
                    <Select label="Modifier color" value={effectiveKitchen.modifier_color} onChange={value => patchKitchen({ modifier_color: value })}><option value="black">Black</option><option value="red">Red — impact printer ribbon</option></Select>
                    <Select label="Note color" value={effectiveKitchen.note_color ?? 'red'} onChange={value => patchKitchen({ note_color: value })}><option value="black">Black</option><option value="red">Red — impact printer ribbon</option></Select>
                    <Select label="Modifier marker" value={effectiveKitchen.modifier_marker ?? 'indent'} onChange={value => patchKitchen({ modifier_marker: value })}><option value="indent">Indent only (recommended)</option><option value="plus">Plus sign</option></Select>
                    <Select label="Vertical density" value={effectiveKitchen.line_density ?? 'tight'} onChange={value => patchKitchen({ line_density: value })}><option value="tight">Shorter same-width font + tight pitch</option><option value="standard">Original tall font + spacing</option></Select>
                  </div>
                  {scope === 'whole' && (
                    (config.kitchen?.modifier_marker ?? 'indent') !== savedKitchenPresentation.modifier_marker
                    || (config.kitchen?.line_density ?? 'tight') !== savedKitchenPresentation.line_density
                  ) && (
                    <div className="mt-3 rounded-xl border border-dash-gold/25 bg-dash-gold/[0.06] p-3">
                      <label className="text-xs font-semibold text-dash-cream">Reason for kitchen-ticket presentation change</label>
                      <input maxLength={300} value={receiptPolicyReason} onChange={event => setReceiptPolicyReason(event.target.value)} placeholder="Example: Adopt the tighter hybrid kitchen ticket" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-dash-gold/60" />
                    </div>
                  )}
                  <p className={`mt-2 text-xs ${supportsRed === false ? 'text-amber-200' : 'text-dash-tertiary'}`}>
                    {supportsRed === true
                      ? 'This impact printer can use its red ribbon for modifiers and notes.'
                      : supportsRed === false
                        ? 'This printer cannot produce red. Requested red emphasis prints bold black instead.'
                        : 'Choose a printer to verify color. Requested red safely falls back to bold black.'}
                  </p>
                </div>
                {/* The shared vocabulary. Each of these renders a concept that appears in
                    more than one place on a ticket, so the choice is made once here rather
                    than per row — a check number cannot read CHK 418 in the heading and
                    ORD-2026-000418 in a row someone added in the builder. */}
                <div className="mt-4">
                  <span className="label-mono">How things read</span>
                  <p className="mt-1 text-xs text-dash-tertiary">Applies everywhere it appears — the heading, the builder rows, and the item lines.</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <Select label="Check number" value={effectiveKitchen.check_number_format ?? 'chk'} onChange={value => patchKitchen({ check_number_format: value })}>
                      <option value="chk">CHK 418 (recommended)</option>
                      <option value="short">418</option>
                      <option value="hash">#418</option>
                      <option value="full">ORD-2026-000418</option>
                      <option value="labeled">Order ORD-2026-000418</option>
                    </Select>
                    <Select label="Sent time" value={effectiveKitchen.time_format ?? 'meridiem'} onChange={value => patchKitchen({ time_format: value })}>
                      <option value="compact">3:14P</option>
                      <option value="meridiem">3:14 PM (recommended)</option>
                      <option value="h24">15:14</option>
                    </Select>
                    <Select label="Seats" value={effectiveKitchen.seat_format ?? 'short'} onChange={value => patchKitchen({ seat_format: value })}>
                      <option value="short">S1 (recommended)</option>
                      <option value="labeled">Seat 1</option>
                      <option value="paren">(Seat 1)</option>
                      <option value="number">1</option>
                    </Select>
                    <Select label="Guest notes" value={effectiveKitchen.note_style ?? 'stars'} onChange={value => patchKitchen({ note_style: value })}>
                      <option value="stars">** NO ONION ** (recommended)</option>
                      <option value="labeled">NOTE: NO ONION</option>
                      <option value="bracket">[NO ONION]</option>
                      <option value="plain">NO ONION</option>
                    </Select>
                    <Select label="Between items" value={effectiveKitchen.item_separator ?? 'dashes'} onChange={value => patchKitchen({ item_separator: value })}>
                      <option value="dots">Dotted rule</option>
                      <option value="dashes">Solid rule (recommended)</option>
                      <option value="blank">Blank line</option>
                      <option value="none">Nothing</option>
                    </Select>
                  </div>
                  <p className="mt-2 text-xs text-dash-tertiary">
                    A seat label with no number ("Window") always prints as written — there is nothing to shorten.
                  </p>
                </div>
                <div className="mt-4"><Toggle label="Bold items (darker)" checked={effectiveKitchen.item_bold ?? true} onChange={value => patchKitchen({ item_bold: value })} /><Toggle label="Print modifiers" checked={effectiveKitchen.print_modifiers} onChange={value => patchKitchen({ print_modifiers: value })} /><Toggle label="Bold modifiers (darker)" checked={effectiveKitchen.modifier_bold ?? true} onChange={value => patchKitchen({ modifier_bold: value })} /><Toggle label="Bold notes (darker)" checked={effectiveKitchen.note_bold ?? true} onChange={value => patchKitchen({ note_bold: value })} /><Toggle label="Print prices" checked={effectiveKitchen.print_prices} onChange={value => patchKitchen({ print_prices: value })} /><Toggle label="Print seats" checked={effectiveKitchen.print_seats} onChange={value => patchKitchen({ print_seats: value })} /><Toggle label="Combine identical items" checked={effectiveKitchen.combine_identical} onChange={value => patchKitchen({ combine_identical: value })} /></div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Printed names</h2><p className="mt-1 text-sm text-dash-tertiary">Full POS names remain unchanged.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-dash-tertiary" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search items or modifiers" className="rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm outline-none" /></div></div>
                <div className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border border-white/10">
                  {filtered.map(row => { const aliases = effectiveAliases(row.kind); const inherited = config.aliases?.[row.kind]?.[row.id]; return <div key={`${row.kind}-${row.id}`} className="grid gap-2 border-b border-white/10 p-3 last:border-0 md:grid-cols-[1.2fr_.9fr_.5fr] md:items-center"><div><p className="text-sm font-medium text-dash-cream">{row.name}</p><p className="text-xs text-dash-tertiary">{row.type}{row.category ? ` · ${row.category}` : ''}</p></div><input value={aliases[row.id] || ''} onChange={event => setAlias(row.kind, row.id, event.target.value)} placeholder={scope !== 'whole' && inherited ? `Inherits ${inherited}` : 'Uses full name'} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-dash-gold/60" /><span className="text-xs text-dash-tertiary">{scope === 'whole' ? 'Whole Kitchen' : aliases[row.id] && aliases[row.id] !== inherited ? 'Station override' : 'Inherited'}</span></div> })}
                </div>
              </div>
            </>
          )}
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-lg font-semibold">Detected printer layout</h2>
            {selectedTarget && displayedCapabilities ? <>
              <p className="mt-1 text-sm text-dash-tertiary">Layout comes from the model already selected for this printer target.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="label-mono">Model</p><p className="mt-1 text-sm font-semibold">{displayedCapabilities.profile || selectedTarget.config?.profile || 'Unknown'}</p></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="label-mono">Roll width</p><p className="mt-1 text-sm font-semibold">{displayedCapabilities.paper_width_mm} mm</p></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="label-mono">Columns</p><p className="mt-1 text-sm font-semibold">{displayedCapabilities.normal_columns} normal · {displayedCapabilities.condensed_columns} compact</p></div>
              </div>
              {!displayedCapabilities.known_profile && <p className="mt-3 text-xs text-amber-200">Unknown model: using the conservative 42-column fallback.</p>}
              {paperWidthOptions.length > 1 && <div className="mt-4 max-w-xs"><Select label="Installed paper roll" value={String(selectedTarget.config?.paper_width_mm || displayedCapabilities.paper_width_mm)} onChange={patchTargetPaperWidth}>{paperWidthOptions.map(width => <option key={width} value={width}>{width} mm</option>)}</Select></div>}
            </> : <p className="mt-2 text-sm text-dash-tertiary">Choose a compatible printer to calculate its usable paper width.</p>}
          </div>
          <button onClick={save} disabled={saving || loading || loadedRestaurantId !== String(restaurantId)} className="rounded-xl bg-dash-gold px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>

        <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.035] p-5 xl:sticky xl:top-20">
          <div className="flex items-center justify-between"><div><p className="label-mono">Live preview</p><h2 className="mt-1 text-lg font-semibold">{previewTitle}</h2></div>{previewStatus === 'ready' ? <span className="inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Real renderer</span> : previewStatus === 'error' ? <span className="inline-flex items-center gap-1 text-xs text-amber-200"><AlertCircle className="h-4 w-4" /> Renderer unavailable</span> : <span className="inline-flex items-center gap-1 text-xs text-dash-tertiary"><Loader2 className="h-4 w-4 animate-spin" /> Rendering</span>}</div>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="mx-auto w-max min-w-[430px] bg-[#fffdf6] px-7 py-8 text-black shadow-2xl">
            <pre className={`whitespace-pre font-mono ${output === 'kitchen_ticket' && (effectiveKitchen.line_density ?? 'tight') === 'tight' ? 'leading-[1.18]' : 'leading-relaxed'} ${previewSize === 'compact' ? 'text-xs' : previewSize === 'large' || previewSize === 'easy_read' ? 'text-base' : 'text-sm'}`}>{previewLines.map((line, index, lines) => {
              const isModifier = output === 'kitchen_ticket' && isKitchenPreviewModifierLine(lines, index)
              const isItem = output === 'kitchen_ticket' && isKitchenPreviewItemLine(line)
              const isMethod = output === 'kitchen_ticket'
                && line.trim() === KITCHEN_METHOD_LABELS[kitchenVariant]
                && (firstPreviewItemIndex < 0 || index < firstPreviewItemIndex)
              const isLocation = output === 'kitchen_ticket'
                && isKitchenPreviewLocationLine(line)
                && (firstPreviewItemIndex < 0 || index < firstPreviewItemIndex)
              // Guest notes carry whichever marker the note style configures, so
              // matching only the old "NOTE:" prefix left them unstyled in the
              // preview under every other choice.
              const isNote = output === 'kitchen_ticket' && (
                /^\s*(NOTE:|\*\* .* \*\*\s*$|\[.*\]\s*$)/.test(line)
                || line.trim() === 'ORDER NOTE'
                || (index > 0 && lines[index - 1].trim() === 'ORDER NOTE')
              )
              const isCheckMemo = output === 'kitchen_ticket' && (
                /^CHECK MEMO(?:\s*[·:]|\s*$)/i.test(line.trim())
                || (index > 0 && /^CHECK MEMO\s*$/i.test(lines[index - 1].trim()))
                || ((firstPreviewItemIndex < 0 || index < firstPreviewItemIndex) && memoPreviewValues.includes(line.trim()))
              )
              const requestedColor = isCheckMemo ? (memoStyle.color ?? 'black') : isNote ? (effectiveKitchen.note_color ?? 'red') : effectiveKitchen.modifier_color
              const requestedBold = isItem ? (effectiveKitchen.item_bold ?? true) : isCheckMemo ? (memoStyle.bold ?? false) : isNote ? (effectiveKitchen.note_bold ?? true) : (effectiveKitchen.modifier_bold ?? true)
              const requestedSize = isCheckMemo ? (memoStyle.size ?? 'standard') : isNote ? (effectiveKitchen.note_size ?? 'large') : (effectiveKitchen.modifier_size ?? 'large')
              const fallbackBold = requestedColor === 'red' && supportsRed === false
              const className = [
                (isModifier || isNote || isCheckMemo) && requestedColor === 'red' && supportsRed === true ? 'text-red-700' : '',
                (isModifier || isNote || isCheckMemo || isItem) && (requestedBold || fallbackBold) ? 'font-bold' : '',
                (isModifier || isNote || isCheckMemo) && requestedSize === 'standard' ? 'text-[0.86em]' : '',
                (isModifier || isNote || isCheckMemo) && requestedSize === 'large' ? 'text-[1em]' : '',
                isCheckMemo && requestedSize === 'double' ? 'text-[1.15em]' : '',
                isMethod && methodStyle.bold ? 'font-bold' : '',
                isMethod && methodStyle.size === 'large' ? 'text-[1.35em] leading-[2.1]' : '',
                isMethod && methodStyle.size === 'double' ? 'text-[1.7em] leading-[2.1]' : '',
                isMethod && !methodStyle.pair && methodStyle.align === 'center' ? 'block text-center' : '',
                isMethod && !methodStyle.pair && methodStyle.align === 'right' ? 'block text-right' : '',
                isLocation && locationStyle.bold ? 'font-bold' : '',
                isLocation && locationStyle.size === 'large' ? 'text-[1.35em] leading-[2.1]' : '',
                isLocation && locationStyle.size === 'double' ? 'text-[1.7em] leading-[2.1]' : '',
                isLocation && !locationStyle.pair && locationStyle.align === 'center' ? 'block text-center' : '',
                isLocation && !locationStyle.pair && locationStyle.align === 'right' ? 'block text-right' : '',
                isCheckMemo && !memoStyle.pair && memoStyle.align === 'center' ? 'block text-center' : '',
                isCheckMemo && !memoStyle.pair && memoStyle.align === 'right' ? 'block text-right' : '',
              ].filter(Boolean).join(' ')
              const displayLine = (isMethod && !methodStyle.pair && ['center', 'right'].includes(methodStyle.align))
                || (isLocation && !locationStyle.pair && ['center', 'right'].includes(locationStyle.align))
                ? line.trim()
                : line
              return <span key={index} className={className}>{displayLine}{'\n'}</span>
            })}</pre>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-dash-tertiary">Uses live menu names and the same ReceiptLine renderer as the printer.</p>
        </div>
      </div>
    </div>
  )
}
