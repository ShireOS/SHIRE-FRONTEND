import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp, RotateCcw } from 'lucide-react'
import { SortableRows, DragHandle } from '../shared/SortableRows'

// Ticket-top builder: two editable zones (big centered header + compact info
// lines) stored as kitchen.header / kitchen.info in the printing config. When
// neither key exists the POS prints its legacy hardcoded ticket top, so the
// builder shows DEFAULT_TICKET_TOP (a mirror of that legacy layout) and only
// materializes rows into the config on the first real edit.

export const TICKET_TOP_FIELDS = {
  order_type: { label: 'Order method', hint: 'DINE IN / TO GO / DELIVERY' },
  station_name: { label: 'Station name', hint: 'e.g. GRILL — per routed station' },
  table: { label: 'Table / tab', hint: 'Table: 12 or Tab: name' },
  check_number: { label: 'Check number', hint: 'Order 1042' },
  server: { label: 'Server', hint: 'Server: name' },
  course: { label: 'Course', hint: 'Prints only on coursed orders' },
  time: { label: 'Sent time', hint: 'Sent: 6:42 PM' },
  guest_count: { label: 'Guest count', hint: 'Guests: 3' },
  restaurant_name: { label: 'Restaurant name', hint: 'From the restaurant record' },
  address: { label: 'Address', hint: 'From the restaurant record' },
  phone: { label: 'Phone', hint: 'From the restaurant record' },
}

const METHODS = [
  { id: 'dine_in', chip: 'DI', label: 'Dine-in' },
  { id: 'togo', chip: 'TG', label: 'To-Go' },
  { id: 'delivery', chip: 'DL', label: 'Delivery' },
]

// Mirrors the legacy hardcoded ticket top the POS prints today, so saving
// without further edits keeps tickets looking the same.
export const DEFAULT_TICKET_TOP = {
  header: [
    { type: 'field', field: 'order_type', size: 'double', bold: true },
    { type: 'field', field: 'station_name', size: 'standard' },
  ],
  info: [
    { type: 'field', field: 'table' },
    { type: 'field', field: 'server' },
    { type: 'field', field: 'course' },
    { type: 'field', field: 'time' },
  ],
}

let rowIdCounter = 0
const nextRowId = () => `ttrow-${++rowIdCounter}`
const withIds = rows => (rows || []).map(row => ({ id: nextRowId(), ...row }))
const stripIds = rows => rows.map(({ id: _id, ...row }) => row)

function MiniSelect({ value, onChange, title, children }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      title={title}
      className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-dash-cream outline-none focus:border-dash-gold/60"
    >
      {children}
    </select>
  )
}

function Chip({ on, tone = 'gold', title, onClick, children }) {
  const active = tone === 'red'
    ? 'border-red-400/50 bg-red-400/10 text-red-200'
    : 'border-dash-gold/50 bg-dash-gold/15 text-dash-gold'
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${on ? active : 'border-white/10 text-dash-tertiary hover:text-dash-secondary'}`}
    >
      {children}
    </button>
  )
}

export default function TicketTopBuilder({ header, info, configured, supportsRed, onChange, onReset }) {
  const [advanced, setAdvanced] = useState(false)
  // Local rows carry stable ids for drag-and-drop; edits are pushed up as
  // plain config rows. Parent remounts this component (key) on scope switches.
  const [zones, setZones] = useState(() => ({
    header: withIds(Array.isArray(header) ? header : DEFAULT_TICKET_TOP.header),
    info: withIds(Array.isArray(info) ? info : DEFAULT_TICKET_TOP.info),
  }))
  const zonesRef = useRef(zones)
  zonesRef.current = zones

  const commit = next => {
    setZones(next)
    onChange(stripIds(next.header), stripIds(next.info))
  }

  const updateRow = (zone, id, patch) => {
    const next = {
      ...zonesRef.current,
      [zone]: zonesRef.current[zone].map(row => (row.id === id ? { ...row, ...patch } : row)),
    }
    commit(next)
  }

  const removeRow = (zone, id) => {
    commit({ ...zonesRef.current, [zone]: zonesRef.current[zone].filter(row => row.id !== id) })
  }

  const moveRow = (zone, id) => {
    const other = zone === 'header' ? 'info' : 'header'
    const row = zonesRef.current[zone].find(candidate => candidate.id === id)
    if (!row) return
    commit({
      ...zonesRef.current,
      [zone]: zonesRef.current[zone].filter(candidate => candidate.id !== id),
      [other]: [...zonesRef.current[other], row],
    })
  }

  const addRow = (zone, row) => {
    commit({ ...zonesRef.current, [zone]: [...zonesRef.current[zone], { id: nextRowId(), ...row }] })
  }

  const reorderZone = (zone, orderedIds) => {
    const byId = new Map(zonesRef.current[zone].map(row => [row.id, row]))
    commit({ ...zonesRef.current, [zone]: orderedIds.map(id => byId.get(id)).filter(Boolean) })
  }

  // The parent removes the spec keys and remounts this component, which then
  // re-reads the post-reset effective rows (whole-kitchen spec or the default).
  const resetToDefault = () => onReset()

  const usedFields = useMemo(() => ({
    header: new Set(zones.header.filter(row => row.type === 'field').map(row => row.field)),
    info: new Set(zones.info.filter(row => row.type === 'field').map(row => row.field)),
  }), [zones])

  const renderRow = zone => (id, { handleProps }) => {
    const row = zones[zone].find(candidate => candidate.id === id)
    if (!row) return null
    const structural = row.type === 'divider' || row.type === 'spacer'
    const onlyWhen = Array.isArray(row.only_when) && row.only_when.length ? row.only_when : null
    return (
      <div className={`mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 ${structural ? 'opacity-80' : ''}`}>
        <DragHandle handleProps={handleProps} />
        <span className="min-w-[92px] text-xs font-semibold text-dash-cream">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-dash-tertiary">
            {row.type === 'field' ? 'Field' : row.type === 'text' ? 'Custom text' : row.type === 'divider' ? 'Divider' : 'Spacer'}
          </span>
          {row.type === 'field' ? (TICKET_TOP_FIELDS[row.field]?.label || row.field) : ''}
        </span>
        {row.type === 'text' && (
          <input
            value={row.text || ''}
            maxLength={60}
            placeholder="PICKUP — CHECK BAG"
            onChange={event => updateRow(zone, id, { text: event.target.value })}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 font-mono text-xs uppercase text-dash-cream outline-none focus:border-dash-gold/60"
          />
        )}
        {row.type === 'divider' && <span className="min-w-[60px] flex-1 border-t border-dashed border-white/20" />}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {!structural && (
            <>
              <MiniSelect value={row.size || 'standard'} onChange={value => updateRow(zone, id, { size: value })} title="Row size">
                <option value="standard">Standard</option>
                <option value="large">Large · tall</option>
                <option value="double">Double · wide</option>
              </MiniSelect>
              <Chip on={row.bold === true} title="Bold" onClick={() => updateRow(zone, id, { bold: !row.bold })}>B</Chip>
              {advanced && (
                <>
                  <Chip
                    on={row.color === 'red'}
                    tone="red"
                    title={supportsRed === false ? 'This printer has no red ribbon — prints bold black instead' : 'Red — impact printer ribbon; thermal falls back to bold black'}
                    onClick={() => updateRow(zone, id, { color: row.color === 'red' ? 'black' : 'red' })}
                  >
                    Red
                  </Chip>
                  <span className="flex gap-0.5 rounded-lg border border-white/10 p-0.5" title="Which order methods print this row">
                    {METHODS.map(method => {
                      const active = !onlyWhen || onlyWhen.includes(method.id)
                      return (
                        <Chip
                          key={method.id}
                          on={active}
                          title={`${method.label}${active ? ' — prints' : ' — hidden'}`}
                          onClick={() => {
                            const current = onlyWhen ? [...onlyWhen] : METHODS.map(item => item.id)
                            const index = current.indexOf(method.id)
                            if (index !== -1) { if (current.length > 1) current.splice(index, 1) }
                            else current.push(method.id)
                            updateRow(zone, id, { only_when: current.length === METHODS.length ? undefined : current })
                          }}
                        >
                          {method.chip}
                        </Chip>
                      )
                    })}
                  </span>
                </>
              )}
            </>
          )}
          {advanced && (
            <button
              type="button"
              title={zone === 'header' ? 'Move to info block' : 'Move to header'}
              onClick={() => moveRow(zone, id)}
              className="rounded-lg border border-white/10 p-1.5 text-dash-tertiary transition hover:border-dash-gold/60 hover:text-dash-gold"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            title="Delete row"
            onClick={() => removeRow(zone, id)}
            className="px-1 text-base leading-none text-dash-tertiary transition hover:text-red-300"
          >
            ×
          </button>
        </span>
      </div>
    )
  }

  const renderAddZone = zone => (
    <div className="mt-1 rounded-xl border border-dashed border-white/10 p-3">
      <span className="label-mono">Optional rows</span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Object.entries(TICKET_TOP_FIELDS).map(([field, meta]) => (
          <button
            key={field}
            type="button"
            title={meta.hint}
            onClick={() => addRow(zone, { type: 'field', field })}
            className={`rounded-full border border-dashed border-white/15 px-3 py-1 text-xs text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold ${usedFields[zone].has(field) ? 'opacity-40' : ''}`}
          >
            + {meta.label}
          </button>
        ))}
        <button type="button" onClick={() => addRow(zone, { type: 'text', text: '' })} className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold">+ Custom text</button>
        <button type="button" onClick={() => addRow(zone, { type: 'divider' })} className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold">+ Divider</button>
        <button type="button" onClick={() => addRow(zone, { type: 'spacer' })} className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold">+ Spacer</button>
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ticket header &amp; info</h2>
          <p className="mt-1 text-sm text-dash-tertiary">
            {configured
              ? 'Customized ticket top. Rows print in this order; empty fields skip automatically.'
              : 'Standard ticket top (what prints today). Any edit starts customizing; nothing changes until you save.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {configured && (
            <button
              type="button"
              onClick={resetToDefault}
              title="Remove customization — tickets print the standard top again"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold"
            >
              <RotateCcw className="h-3 w-3" /> Reset to standard
            </button>
          )}
          <button
            type="button"
            onClick={() => setAdvanced(current => !current)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${advanced ? 'border-dash-gold/50 bg-dash-gold/15 text-dash-gold' : 'border-white/10 text-dash-secondary hover:text-dash-cream'}`}
          >
            Advanced
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="label-mono">Header</span>
          <span className="text-xs text-dash-tertiary">big &amp; centered</span>
        </div>
        <div className="mt-2">
          <SortableRows ids={zones.header.map(row => row.id)} onReorder={ids => reorderZone('header', ids)} renderRow={renderRow('header')} />
        </div>
        {advanced && renderAddZone('header')}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline gap-2">
          <span className="label-mono">Info block</span>
          <span className="text-xs text-dash-tertiary">compact lines — table, server, course…</span>
        </div>
        <div className="mt-2">
          <SortableRows ids={zones.info.map(row => row.id)} onReorder={ids => reorderZone('info', ids)} renderRow={renderRow('info')} />
        </div>
        {advanced && renderAddZone('info')}
      </div>

      {!advanced && (
        <p className="mt-3 text-xs text-dash-tertiary">
          Red ink, per-method rows (e.g. a To-Go banner), optional fields, and custom text live under{' '}
          <button type="button" onClick={() => setAdvanced(true)} className="font-semibold text-dash-gold">Advanced</button>.
        </p>
      )}
    </div>
  )
}
