import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Clock3, FileText, ListChecks, Phone, Plus, Printer, ReceiptText, ShieldCheck, Trash2, UserRoundCheck, Utensils } from 'lucide-react'
import { fetchPosApi } from '../../shared/api/posClient'

const ACTION_LABELS = {
  discount: 'Discounts',
  comp: 'Comps',
  item_void: 'Item voids',
  check_void: 'Check voids',
}

const ACTION_ORDER = ['discount', 'comp', 'item_void', 'check_void']

const ACCESS_LABELS = {
  none: 'No PIN',
  staff_pin: 'Staff PIN',
  manager_pin: 'Manager PIN',
}

const ACCESS_RANK = {
  none: 0,
  staff_pin: 1,
  manager_pin: 2,
}

const REPORT_SECTIONS = [
  ['sales_revenue', 'Sales & revenue'],
  ['top_bottom_sellers', 'Top & bottom sellers'],
  ['average_check', 'Average check'],
  ['employee_reports', 'Employee reports'],
  ['payroll_support', 'Payroll support'],
  ['punch_log', 'Punch log'],
  ['z_report', 'Z report'],
  ['tax_summary', 'Tax'],
  ['daily_summary', 'Daily summary'],
]
const REPORT_SECTION_IDS = new Set(REPORT_SECTIONS.map(([id]) => id))

const WIDGETS = [
  { id: 'daily_specials', label: 'Daily Specials', caption: 'View active specials for today.', defaultAccess: 'none', minimumAccess: 'none', icon: Utensils },
  { id: 'eighty_six', label: '86 List', caption: 'See items unavailable right now.', defaultAccess: 'none', minimumAccess: 'none', icon: ListChecks },
  { id: 'reservations', label: 'Reservations', caption: 'Live reservation snapshot for the restaurant.', defaultAccess: 'none', minimumAccess: 'none', icon: CalendarDays },
  { id: 'phone_order', label: 'Phone Order', caption: 'Fast entry into a phone-order workflow.', defaultAccess: 'staff_pin', minimumAccess: 'staff_pin', icon: Phone },
  { id: 'time_clock', label: 'Time Clock', caption: 'Use the PIN panel for clock in, clock out, and breaks.', defaultAccess: 'none', minimumAccess: 'none', icon: Clock3 },
  { id: 'my_shift_report', label: 'My Shift Report', caption: 'Staff PIN prints the server checkout report.', defaultAccess: 'staff_pin', minimumAccess: 'staff_pin', icon: ReceiptText },
  { id: 'bar_tabs', label: 'Bar Tabs', caption: 'Open the bar tab workflow after staff PIN.', defaultAccess: 'staff_pin', minimumAccess: 'staff_pin', icon: UserRoundCheck },
  { id: 'delivery_pickup', label: 'Delivery', caption: 'Open delivery and pickup work after staff PIN.', defaultAccess: 'staff_pin', minimumAccess: 'staff_pin', icon: FileText },
  { id: 'print_specials', label: 'Print Specials', caption: 'Print today specials once the print source is connected.', defaultAccess: 'manager_pin', minimumAccess: 'manager_pin', icon: Printer },
  { id: 'today_sales', label: "Today's Sales", caption: 'PIN-free paired-terminal snapshot: net sales, checks, average check, and open-check count.', defaultAccess: 'none', minimumAccess: 'none', icon: BarChart3 },
  { id: 'custom_report', label: 'Custom Report', caption: 'Open one existing canonical report section after manager PIN.', defaultAccess: 'manager_pin', minimumAccess: 'manager_pin', icon: FileText },
]

const WIDGET_BY_ID = Object.fromEntries(WIDGETS.map((widget) => [widget.id, widget]))

const DEFAULT_TERMINAL_HOME = {
  maxSlots: 6,
  bottomClock: true,
  tiles: [
    { id: 'daily_specials-0', widget: 'daily_specials', label: 'Daily Specials', accessMode: 'none', slot: 0, placement: 'left' },
    { id: 'eighty_six-1', widget: 'eighty_six', label: '86 List', accessMode: 'none', slot: 1, placement: 'left' },
    { id: 'reservations-2', widget: 'reservations', label: 'Reservations', accessMode: 'none', slot: 2, placement: 'left' },
    { id: 'phone_order-3', widget: 'phone_order', label: 'Phone Order', accessMode: 'staff_pin', slot: 3, placement: 'right' },
    { id: 'my_shift_report-4', widget: 'my_shift_report', label: 'My Shift Report', accessMode: 'staff_pin', slot: 4, placement: 'right' },
    { id: 'today_sales-5', widget: 'today_sales', label: "Today's Sales", accessMode: 'none', slot: 5, placement: 'right' },
  ],
}

function normalizeTerminalHomeConfig(value) {
  const raw = value && typeof value === 'object' ? value : {}
  const maxSlots = Math.min(8, Math.max(4, Number(raw.maxSlots || 6) || 6))
  const seenSlots = new Set()
  const tiles = Array.isArray(raw.tiles)
    ? raw.tiles
        .map((tile, index) => {
          const widget = WIDGET_BY_ID[tile?.widget]
          if (!widget) return null
          const slot = Number.isFinite(Number(tile.slot)) ? Number(tile.slot) : index
          if (slot < 0 || slot >= maxSlots || seenSlots.has(slot)) return null
          seenSlots.add(slot)
          const requestedAccess = ACCESS_RANK[tile.accessMode] == null ? widget.defaultAccess : tile.accessMode
          const accessMode = ACCESS_RANK[requestedAccess] >= ACCESS_RANK[widget.minimumAccess]
            ? requestedAccess
            : widget.minimumAccess
          const placement = tile.placement === 'right' ? 'right' : tile.placement === 'left'
            ? 'left'
            : slot < Math.ceil(maxSlots / 2) ? 'left' : 'right'
          const normalized = {
            id: String(tile.id || `${widget.id}-${slot}`),
            widget: widget.id,
            label: String(tile.label || widget.label).slice(0, 48),
            accessMode,
            slot,
            placement,
          }
          if (widget.id === 'custom_report') {
            normalized.reportSection = REPORT_SECTION_IDS.has(tile.reportSection) ? tile.reportSection : 'sales_revenue'
          }
          return normalized
        })
        .filter(Boolean)
        .sort((a, b) => a.slot - b.slot)
        .slice(0, maxSlots)
    : []
  return { maxSlots, bottomClock: true, tiles: tiles.length ? tiles : DEFAULT_TERMINAL_HOME.tiles.slice(0, maxSlots) }
}

function nextEmptySlot(config) {
  const used = new Set(config.tiles.map((tile) => tile.slot))
  for (let slot = 0; slot < config.maxSlots; slot += 1) {
    if (!used.has(slot)) return slot
  }
  return null
}

function createTile(widgetId, slot, placement) {
  const widget = WIDGET_BY_ID[widgetId]
  return {
    id: `${widgetId}-${slot}-${Date.now()}`,
    widget: widgetId,
    label: widget.label,
    accessMode: widget.defaultAccess,
    slot,
    placement,
    ...(widgetId === 'custom_report' ? { reportSection: 'sales_revenue' } : {}),
  }
}

function TerminalHomeDesigner({ restaurantId }) {
  const [config, setConfig] = useState(() => normalizeTerminalHomeConfig())
  const [savedConfig, setSavedConfig] = useState(() => normalizeTerminalHomeConfig())
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedTile = config.tiles.find((tile) => tile.id === selectedId) || config.tiles[0] || null
  const isFull = config.tiles.length >= config.maxSlots

  const load = async () => {
    setError('')
    try {
      const data = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/terminal-home-config`)
      const normalized = normalizeTerminalHomeConfig(data)
      setConfig(normalized)
      setSavedConfig(normalized)
      setSelectedId((current) => normalized.tiles.some((tile) => tile.id === current) ? current : normalized.tiles[0]?.id || null)
    } catch (err) {
      setError(err?.message || 'Could not load terminal home config')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    void load()
  }, [restaurantId])

  const patchTile = (tileId, patch) => {
    setConfig((current) => normalizeTerminalHomeConfig({
      ...current,
      tiles: current.tiles.map((tile) => {
        const target = current.tiles.find((item) => item.id === tileId)
        if (target && tile.id !== tileId && patch.slot != null && tile.slot === Number(patch.slot)) {
          return { ...tile, slot: target.slot }
        }
        if (tile.id !== tileId) return tile
        const next = { ...tile, ...patch }
        const widget = WIDGET_BY_ID[next.widget] || WIDGET_BY_ID.daily_specials
        if (patch.widget) {
          next.label = widget.label
          next.accessMode = ACCESS_RANK[next.accessMode] >= ACCESS_RANK[widget.minimumAccess] ? next.accessMode : widget.defaultAccess
          if (widget.id === 'custom_report') next.reportSection = REPORT_SECTION_IDS.has(next.reportSection) ? next.reportSection : 'sales_revenue'
          else delete next.reportSection
        }
        if (ACCESS_RANK[next.accessMode] < ACCESS_RANK[widget.minimumAccess]) next.accessMode = widget.minimumAccess
        return next
      }),
    }))
    setMessage('')
  }

  const updateMaxSlots = (maxSlots) => {
    setConfig((current) => {
      const nextMax = Math.min(8, Math.max(4, Number(maxSlots) || 6))
      const next = normalizeTerminalHomeConfig({
        ...current,
        maxSlots: nextMax,
        tiles: current.tiles.filter((tile) => tile.slot < nextMax),
      })
      setSelectedId((selected) => next.tiles.some((tile) => tile.id === selected) ? selected : next.tiles[0]?.id || null)
      return next
    })
    setMessage('')
  }

  const addTile = (preferredPlacement) => {
    const slot = nextEmptySlot(config)
    if (slot == null) return
    const leftCount = config.tiles.filter((tile) => tile.placement === 'left').length
    const rightCount = config.tiles.length - leftCount
    const placement = preferredPlacement === 'left' || preferredPlacement === 'right'
      ? preferredPlacement
      : leftCount <= rightCount ? 'left' : 'right'
    const tile = createTile('daily_specials', slot, placement)
    setConfig((current) => normalizeTerminalHomeConfig({ ...current, tiles: [...current.tiles, tile] }))
    setSelectedId(tile.id)
    setMessage('')
  }

  const removeTile = (tileId) => {
    setConfig((current) => {
      const next = normalizeTerminalHomeConfig({ ...current, tiles: current.tiles.filter((tile) => tile.id !== tileId) })
      setSelectedId(next.tiles[0]?.id || null)
      return next
    })
    setMessage('')
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const saved = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/terminal-home-config`, {
        method: 'PUT',
        body: JSON.stringify(config),
      })
      const normalized = normalizeTerminalHomeConfig(saved)
      setConfig(normalized)
      setSavedConfig(normalized)
      setSelectedId((current) => normalized.tiles.some((tile) => tile.id === current) ? current : normalized.tiles[0]?.id || null)
      setMessage('Terminal quick access saved')
    } catch (err) {
      setError(err?.message || 'Could not save terminal home config')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    const restored = structuredClone(savedConfig)
    setConfig(restored)
    setSelectedId((current) => restored.tiles.some((tile) => tile.id === current) ? current : restored.tiles[0]?.id || null)
    setError('')
    setMessage('Changes discarded')
  }

  return (
    <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-mono text-dash-tertiary">Terminal home</p>
          <h2 className="mt-1 text-2xl font-semibold text-dash-cream">Quick access defaults</h2>
          <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
            Restaurant-wide left and right shortcuts for fixed POS terminals. Time Clock always remains at the bottom, and a terminal can still keep its own override from the PIN screen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={config.maxSlots}
            onChange={(event) => updateMaxSlots(event.target.value)}
            className="rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm font-semibold text-dash-cream outline-none"
          >
            {[4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value} slots</option>)}
          </select>
          <button type="button" onClick={discard} disabled={saving || loading} className="rounded-xl border border-dash-border px-5 py-2 text-sm font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="rounded-xl bg-shell-accent px-5 py-2 text-sm font-semibold text-dash-base disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {loading ? <div className="mt-4 rounded-xl border border-dash-border bg-dash-surface p-4 text-sm text-dash-secondary">Loading terminal config...</div> : null}
      {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-dash-secondary">Terminal preview</div>
            <div className="flex gap-2">
              {['left', 'right'].map((placement) => (
                <button
                  key={placement}
                  type="button"
                  onClick={() => addTile(placement)}
                  disabled={isFull}
                  className="inline-flex items-center gap-2 rounded-xl border border-dash-border px-3 py-2 text-sm font-semibold capitalize text-dash-cream disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={16} />
                  {placement}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {['left', 'right'].map((placement) => (
              <div key={placement} className="rounded-xl border border-dash-border bg-dash-panel/60 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{placement} rail</div>
                <div className="space-y-2">
            {config.tiles.filter((tile) => tile.placement === placement).map((tile) => {
              const widget = WIDGET_BY_ID[tile.widget]
              const Icon = widget.icon
              const selected = tile.id === selectedTile?.id
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setSelectedId(tile.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected
                      ? 'border-shell-accent bg-shell-accent/10'
                      : 'border-dash-border bg-dash-panel hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/8 text-dash-cream">
                      <Icon size={18} />
                    </span>
                    <span className="rounded-full border border-dash-border px-2 py-1 text-[11px] font-semibold text-dash-tertiary">
                      {ACCESS_LABELS[tile.accessMode]}
                    </span>
                  </div>
                  <div className="mt-3 font-semibold text-dash-cream">{tile.label}</div>
                  <div className="mt-1 truncate text-sm text-dash-tertiary">{widget.caption}</div>
                </button>
              )
            })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dash-border bg-dash-panel px-4 py-3 text-sm font-semibold text-dash-cream">
            <Clock3 size={17} />
            Time Clock stays fixed at the bottom
          </div>
        </div>

        <aside className="rounded-2xl border border-dash-border bg-dash-surface p-4">
          {selectedTile ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label-mono text-dash-tertiary">Selected tile</p>
                  <h3 className="mt-1 text-lg font-semibold text-dash-cream">{selectedTile.label}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => removeTile(selectedTile.id)}
                  className="rounded-lg border border-red-400/30 p-2 text-red-200 hover:bg-red-500/10"
                  title="Remove tile"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">Widget</span>
                <select
                  value={selectedTile.widget}
                  onChange={(event) => patchTile(selectedTile.id, { widget: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-dash-border bg-dash-panel px-3 py-2 text-sm font-semibold text-dash-cream outline-none"
                >
                  {WIDGETS.map((widget) => <option key={widget.id} value={widget.id}>{widget.label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">Label</span>
                <input
                  value={selectedTile.label}
                  onChange={(event) => patchTile(selectedTile.id, { label: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-dash-border bg-dash-panel px-3 py-2 text-sm font-semibold text-dash-cream outline-none"
                />
              </label>

              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">Side</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {['left', 'right'].map((placement) => (
                    <button
                      key={placement}
                      type="button"
                      onClick={() => patchTile(selectedTile.id, { placement })}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize ${
                        selectedTile.placement === placement
                          ? 'border-shell-accent bg-shell-accent/10 text-shell-accent'
                          : 'border-dash-border text-dash-secondary hover:bg-white/5'
                      }`}
                    >
                      {placement}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTile.widget === 'custom_report' ? (
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">Report</span>
                  <select
                    value={selectedTile.reportSection || 'sales_revenue'}
                    onChange={(event) => patchTile(selectedTile.id, { reportSection: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-dash-border bg-dash-panel px-3 py-2 text-sm font-semibold text-dash-cream outline-none"
                  >
                    {REPORT_SECTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
              ) : null}

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">Slot</span>
                <select
                  value={selectedTile.slot}
                  onChange={(event) => patchTile(selectedTile.id, { slot: Number(event.target.value) })}
                  className="mt-2 w-full rounded-xl border border-dash-border bg-dash-panel px-3 py-2 text-sm font-semibold text-dash-cream outline-none"
                >
                  {Array.from({ length: config.maxSlots }, (_, slot) => (
                    <option key={slot} value={slot}>Slot {slot + 1}</option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">Access</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {Object.keys(ACCESS_LABELS).map((access) => {
                    const widget = WIDGET_BY_ID[selectedTile.widget]
                    const disabled = ACCESS_RANK[access] < ACCESS_RANK[widget.minimumAccess]
                    const active = selectedTile.accessMode === access
                    return (
                      <button
                        key={access}
                        type="button"
                        disabled={disabled}
                        onClick={() => patchTile(selectedTile.id, { accessMode: access })}
                        className={`rounded-xl border px-2 py-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${
                          active
                            ? 'border-shell-accent bg-shell-accent/10 text-shell-accent'
                            : 'border-dash-border text-dash-secondary hover:bg-white/5'
                        }`}
                      >
                        {ACCESS_LABELS[access]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-dash-border bg-dash-panel p-3 text-sm text-dash-secondary">
                {WIDGET_BY_ID[selectedTile.widget]?.caption}
                {selectedTile.widget === 'custom_report' ? ' Manager PIN is mandatory and cannot be lowered.' : null}
              </div>
            </div>
          ) : (
            <div className="text-sm text-dash-tertiary">Add a shortcut to edit it.</div>
          )}
        </aside>
      </div>
    </section>
  )
}

const DEFAULT_MANAGER_APPROVAL_POLICY = {
  enabled: true,
  item_void_enabled: true,
  require_manager_on_duty: true,
  offline_lan_enabled: true,
  request_ttl_seconds: 90,
}

function ManagerApprovalSettings({ restaurantId }) {
  const [policy, setPolicy] = useState(DEFAULT_MANAGER_APPROVAL_POLICY)
  const [savedPolicy, setSavedPolicy] = useState(DEFAULT_MANAGER_APPROVAL_POLICY)
  const [changeReason, setChangeReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchPosApi(restaurantId, `/restaurants/${restaurantId}/manager-approval-policy`)
      .then((data) => {
        if (!cancelled) {
          const normalized = { ...DEFAULT_MANAGER_APPROVAL_POLICY, ...(data || {}) }
          setPolicy(normalized)
          setSavedPolicy(normalized)
        }
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load manager approval settings') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId])

  const toggle = (key) => setPolicy((current) => ({ ...current, [key]: !current[key] }))

  const save = async () => {
    if (changeReason.trim().length < 2) {
      setError('Add a brief reason for this policy change')
      return
    }
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const saved = await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/manager-approval-policy`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: policy.enabled,
          item_void_enabled: policy.item_void_enabled,
          require_manager_on_duty: policy.require_manager_on_duty,
          offline_lan_enabled: policy.offline_lan_enabled,
          request_ttl_seconds: Number(policy.request_ttl_seconds),
          change_reason: changeReason.trim(),
        }),
      })
      const normalized = { ...DEFAULT_MANAGER_APPROVAL_POLICY, ...saved }
      setPolicy(normalized)
      setSavedPolicy(normalized)
      setChangeReason('')
      setMessage('Manager approval policy saved and audited')
    } catch (err) {
      setError(err?.message || 'Could not save manager approval settings')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setPolicy(structuredClone(savedPolicy))
    setChangeReason('')
    setError('')
    setMessage('Changes discarded')
  }

  const rows = [
    { key: 'enabled', label: 'Ping manager', caption: 'Show the remote approval pill beneath eligible POS manager PIN pads.' },
    { key: 'item_void_enabled', label: 'Sent-item voids', caption: 'First supported action. The existing correction audit remains authoritative.' },
    { key: 'require_manager_on_duty', label: 'Require manager on duty', caption: 'Only offer a ping when at least one active manager is clocked in.' },
    { key: 'offline_lan_enabled', label: 'Temporary-outage delivery', caption: 'Allow signed local-network delivery; execution still waits for backend verification.' },
  ]

  return (
    <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="mt-1 rounded-xl bg-shell-accent/10 p-2 text-shell-accent"><ShieldCheck size={20} /></div>
          <div>
            <p className="label-mono text-dash-tertiary">Manager workflow</p>
            <h2 className="mt-1 text-2xl font-semibold text-dash-cream">Remote approval</h2>
            <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
              Keep the normal manager PIN flow and add an immediate ping to manager terminals. Requester, reason, decision, and resulting void share the normal audit path.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={discard} disabled={saving || loading} className="rounded-xl border border-dash-border px-5 py-2 text-sm font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving || loading} className="rounded-xl bg-shell-accent px-5 py-2 text-sm font-semibold text-dash-base disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {loading ? <div className="mt-4 text-sm text-dash-secondary">Loading manager approval policy...</div> : null}
      {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div> : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <button key={row.key} type="button" onClick={() => toggle(row.key)} className="flex items-center justify-between gap-4 rounded-xl border border-dash-border bg-dash-surface p-4 text-left">
            <span>
              <span className="block text-sm font-semibold text-dash-cream">{row.label}</span>
              <span className="mt-1 block text-xs leading-5 text-dash-secondary">{row.caption}</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${policy[row.key] ? 'bg-shell-accent' : 'bg-white/15'}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${policy[row.key] ? 'left-6' : 'left-1'}`} />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="text-sm font-semibold text-dash-secondary">
          Request expires after
          <select value={policy.request_ttl_seconds} onChange={(event) => setPolicy((current) => ({ ...current, request_ttl_seconds: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-dash-cream outline-none">
            {[60, 90, 120, 180].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-dash-secondary">
          Change reason
          <input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Why is this policy changing?" className="mt-2 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-dash-cream placeholder:text-dash-tertiary outline-none" />
        </label>
      </div>
    </section>
  )
}

export default function PosSettingsPage({ restaurantId }) {
  const [presets, setPresets] = useState([])
  const [actionType, setActionType] = useState('discount')
  const [label, setLabel] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const grouped = useMemo(() => {
    const map = new Map(ACTION_ORDER.map((action) => [action, []]))
    presets.forEach((preset) => {
      if (map.has(preset.action_type)) map.get(preset.action_type).push(preset)
    })
    map.forEach((items) => items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label)))
    return map
  }, [presets])

  const load = async () => {
    setError('')
    try {
      const data = await fetchPosApi(restaurantId, '/manager/reason-presets?include_inactive=true')
      setPresets(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.message || 'Could not load reason presets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    void load()
  }, [restaurantId])

  const beginEdit = (preset) => {
    setEditingId(preset.id)
    setActionType(preset.action_type)
    setLabel(preset.label)
    setMessage('')
    setError('')
  }

  const savePreset = async () => {
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Preset label is required')
      return
    }
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await fetchPosApi(restaurantId, '/manager/reason-presets', {
        method: 'POST',
        body: JSON.stringify({
          id: editingId || undefined,
          action_type: actionType,
          label: trimmed,
          sort_order: editingId ? presets.find((preset) => preset.id === editingId)?.sort_order : grouped.get(actionType)?.length,
          is_active: true,
        }),
      })
      setEditingId(null)
      setLabel('')
      setMessage('Reason presets saved')
      await load()
    } catch (err) {
      setError(err?.message || 'Could not save reason preset')
    } finally {
      setSaving(false)
    }
  }

  const archivePreset = async (preset) => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await fetchPosApi(restaurantId, `/manager/reason-presets/${preset.id}`, { method: 'DELETE' })
      setMessage('Reason preset archived')
      await load()
    } catch (err) {
      setError(err?.message || 'Could not archive reason preset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono text-dash-tertiary">POS controls</p>
            <h1 className="mt-1 text-2xl font-semibold text-dash-cream">Reason presets</h1>
            <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
              Restaurant-wide categories for discounts, comps, item voids, and whole-check voids. Notes stay optional at the POS.
            </p>
          </div>
        </div>
      </section>

      {loading ? <div className="rounded-xl border border-dash-border bg-dash-panel p-4 text-sm text-dash-secondary">Loading presets...</div> : null}
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      <TerminalHomeDesigner restaurantId={restaurantId} />

      <ManagerApprovalSettings restaurantId={restaurantId} />

      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5">
        <div className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto]">
          <select
            value={actionType}
            onChange={(event) => setActionType(event.target.value)}
            className="rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm font-semibold text-dash-cream outline-none"
          >
            {ACTION_ORDER.map((action) => <option key={action} value={action}>{ACTION_LABELS[action]}</option>)}
          </select>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Preset label"
            className="rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm font-semibold text-dash-cream placeholder:text-dash-tertiary outline-none"
          />
          <button type="button" onClick={() => { setEditingId(null); setActionType('discount'); setLabel(''); setError(''); setMessage('Changes discarded') }} disabled={saving || (!editingId && !label)} className="rounded-xl border border-dash-border px-5 py-2 text-sm font-semibold text-dash-secondary hover:text-dash-cream disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={savePreset}
            disabled={saving}
            className="rounded-xl bg-shell-accent px-5 py-2 text-sm font-semibold text-dash-base disabled:opacity-50"
          >
            {editingId ? 'Update' : 'Add'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {ACTION_ORDER.map((action) => (
          <div key={action} className="rounded-2xl border border-dash-border bg-dash-panel p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-dash-secondary">{ACTION_LABELS[action]}</h2>
            <div className="mt-4 space-y-2">
              {(grouped.get(action) || []).map((preset) => (
                <div key={preset.id} className="flex items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-surface px-4 py-3">
                  <div>
                    <div className={preset.is_active ? 'font-semibold text-dash-cream' : 'font-semibold text-dash-tertiary'}>{preset.label}</div>
                    <div className="mt-1 font-mono text-[11px] uppercase text-dash-tertiary">{preset.code}</div>
                  </div>
                  <div className="flex gap-3 text-sm font-semibold">
                    <button type="button" onClick={() => beginEdit(preset)} className="text-shell-accent">Edit</button>
                    {preset.is_active ? <button type="button" onClick={() => archivePreset(preset)} className="text-red-200">Archive</button> : null}
                  </div>
                </div>
              ))}
              {(grouped.get(action) || []).length === 0 ? <div className="text-sm text-dash-tertiary">No presets yet.</div> : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
