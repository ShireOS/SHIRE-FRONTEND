import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, RotateCcw } from 'lucide-react'
import { SortableRows, DragHandle } from '../shared/SortableRows'
import {
  buildTicketTopPatch,
  ticketTopEditorRows,
  ticketTopRowsMatch,
  ticketTopSideLabel,
  ticketTopSideParts,
} from './ticketTopPolicy'

// Ticket-top builder: two editable zones (header + compact info lines) stored as
// kitchen.header / kitchen.info in the printing config. When neither key exists
// the POS resolves the shipped default at print time — it is never written into
// a restaurant's config, so an unconfigured restaurant keeps tracking
// improvements to the default instead of freezing a copy of it. Replacing it
// with your own rows is an explicit action, and starts from a faithful copy of
// what was already printing.

// Fields come in two flavours: a labelled one that reads as its own line
// ("Server: Marcus") and a bare one for composing inside a two-column row
// ("Marcus"). Bare fields are marked `bare` — they are offered inside the column
// editor rather than as standalone rows, where an unlabelled value reads as
// orphaned text.
export const TICKET_TOP_FIELDS = {
  order_type: { label: 'Order method', hint: 'DINE IN / TO GO / DELIVERY' },
  station_name: { label: 'Station name', hint: 'e.g. GRILL — per routed station' },
  table: { label: 'Table / tab', hint: 'Table: 12 or Tab: name' },
  check_number: { label: 'Check number', hint: 'Follows the check number format' },
  server: { label: 'Server', hint: 'Server: name' },
  course: { label: 'Course', hint: 'Prints only on coursed orders' },
  time: { label: 'Sent time', hint: 'Sent: 6:42P' },
  guest_count: { label: 'Guest count', hint: 'Guests: 3' },
  restaurant_name: { label: 'Restaurant name', hint: 'From the restaurant record' },
  address: { label: 'Address', hint: 'From the restaurant record' },
  phone: { label: 'Phone', hint: 'From the restaurant record' },
  check_memo: { label: 'Check memo', hint: 'CHECK MEMO · whole-check instruction' },
  location: { label: 'Table / tab (bare)', hint: 'Table 12 — no label', bare: true },
  check_number_only: { label: 'Check number (bare)', hint: '418 — digits only', bare: true },
  server_name: { label: 'Server name (bare)', hint: 'Marcus — no label', bare: true },
  time_only: { label: 'Sent time (bare)', hint: '6:42P — no label', bare: true },
  course_banner: { label: 'Course banner', hint: 'COURSE: DESSERT', bare: true },
  guest_count_only: { label: 'Guest count (bare)', hint: '3 — digits only', bare: true },
  check_memo_label: { label: 'Check memo label (bare)', hint: 'CHECK MEMO — label only', bare: true },
  check_memo_value: { label: 'Check memo value (bare)', hint: 'Memo text without the label', bare: true },
}

const fieldLabel = field => TICKET_TOP_FIELDS[field]?.label || field
const STANDALONE_FIELDS = Object.entries(TICKET_TOP_FIELDS).filter(([, meta]) => !meta.bare)

const ROW_TYPE_LABELS = {
  field: 'Field',
  text: 'Custom text',
  pair: 'Two columns',
  divider: 'Divider',
  spacer: 'Spacer',
}

// A fresh two-column row: the shape most people want first is "something on the
// left, something on the right", so it starts filled rather than empty.
const NEW_PAIR_ROW = {
  type: 'pair',
  left: { parts: [{ field: 'location' }], size: 'standard', bold: false },
  right: { parts: [{ field: 'time_only' }], size: 'standard', bold: false },
  right_width: 10,
}

const METHODS = [
  { id: 'dine_in', chip: 'DI', label: 'Dine-in' },
  { id: 'togo', chip: 'TG', label: 'To-Go' },
  { id: 'delivery', chip: 'DL', label: 'Delivery' },
]

let rowIdCounter = 0
const nextRowId = () => `ttrow-${++rowIdCounter}`
const withIds = rows => (rows || []).map(row => ({ id: nextRowId(), ...row }))

function MiniSelect({ value, onChange, title, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      title={title}
      className={`min-w-0 max-w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-dash-cream outline-none focus:border-dash-gold/60 ${className}`}
    >
      {children}
    </select>
  )
}

// One column of a two-column row. A column is a list of parts plus a rule for
// combining them: "join" prints every part that resolves (Table 12 · Marcus),
// "first" prints the first that resolves, which is how a column expresses a
// fallback (the check number, or the table when a ticket has no number yet).
function ColumnEditor({ side, label, onChange }) {
  const parts = ticketTopSideParts(side)
  const mode = side?.mode === 'first' ? 'first' : 'join'

  const patch = next => onChange({ ...(side || {}), parts, ...next })
  const patchPart = (index, next) => patch({
    parts: parts.map((part, position) => (position === index ? { ...part, ...next } : part)),
  })

  return (
    <div className="min-w-0 flex-1 basis-[220px] rounded-lg border border-white/10 bg-black/15 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-dash-tertiary">{label}</span>
        <span className="flex min-w-0 flex-wrap items-center justify-end gap-1">
          <MiniSelect value={side?.size || 'standard'} onChange={value => patch({ size: value })} title="Column size">
            <option value="standard">Standard</option>
            <option value="large">Large · tall</option>
            <option value="double">Double · wide</option>
          </MiniSelect>
          <Chip on={side?.bold === true} title="Bold" onClick={() => patch({ bold: !side?.bold })}>B</Chip>
        </span>
      </div>
      {parts.map((part, index) => (
        <div key={index} className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
          <MiniSelect
            value={part.field || ''}
            onChange={value => patchPart(index, { field: value, text: undefined })}
            title="What prints here"
            className="w-full"
          >
            {Object.entries(TICKET_TOP_FIELDS).map(([field, meta]) => (
              <option key={field} value={field}>{meta.label}</option>
            ))}
          </MiniSelect>
          <span className="flex shrink-0 items-center gap-1">
            {index > 0 && (
              <Chip
                on={part.hide_if_duplicate === true}
                title="Skip this when the same text already printed higher up the ticket"
                onClick={() => patchPart(index, { hide_if_duplicate: !part.hide_if_duplicate || undefined })}
              >
                No repeat
              </Chip>
            )}
            {parts.length > 1 && (
              <button
                type="button"
                title="Remove"
                onClick={() => patch({ parts: parts.filter((_, position) => position !== index) })}
                className="px-1 text-sm leading-none text-dash-tertiary transition hover:text-red-300"
              >
                ×
              </button>
            )}
          </span>
        </div>
      ))}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {parts.length < 4 && (
          <button
            type="button"
            onClick={() => patch({ parts: [...parts, { field: 'server_name' }] })}
            className="rounded-full border border-dashed border-white/15 px-2 py-0.5 text-[11px] text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold"
          >
            + Field
          </button>
        )}
        {parts.length > 1 && (
          <MiniSelect value={mode} onChange={value => patch({ mode: value })} title="How the fields combine">
            <option value="join">Combine all</option>
            <option value="first">First that has a value</option>
          </MiniSelect>
        )}
        {parts.length > 1 && mode === 'join' && (
          <input
            value={side?.join ?? ' · '}
            maxLength={8}
            onChange={event => patch({ join: event.target.value })}
            title="Text between the fields"
            className="w-14 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-center font-mono text-xs text-dash-cream outline-none focus:border-dash-gold/60"
          />
        )}
      </div>
    </div>
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

export default function TicketTopBuilder({ header, info, configured, inherited, stationScoped, canReset, supportsRed, onChange, onReset }) {
  const externalRows = useMemo(
    () => ticketTopEditorRows(header, info, configured),
    [configured, header, info],
  )
  // Local rows carry stable ids for drag-and-drop. Prop changes after an async
  // load/save or restaurant switch are reconciled below without churning ids
  // after ordinary local edits.
  const [zones, setZones] = useState(() => ({
    header: withIds(externalRows.header),
    info: withIds(externalRows.info),
  }))
  const zonesRef = useRef(zones)
  zonesRef.current = zones

  useLayoutEffect(() => {
    if (ticketTopRowsMatch(zonesRef.current, externalRows)) return
    const next = {
      header: withIds(externalRows.header),
      info: withIds(externalRows.info),
    }
    zonesRef.current = next
    setZones(next)
  }, [externalRows])

  const commit = (next, changedZones) => {
    zonesRef.current = next
    setZones(next)
    onChange(buildTicketTopPatch(next, changedZones))
  }

  const updateRow = (zone, id, patch) => {
    const next = {
      ...zonesRef.current,
      [zone]: zonesRef.current[zone].map(row => (row.id === id ? { ...row, ...patch } : row)),
    }
    commit(next, [zone])
  }

  const removeRow = (zone, id) => {
    commit({ ...zonesRef.current, [zone]: zonesRef.current[zone].filter(row => row.id !== id) }, [zone])
  }

  const moveRow = (zone, id) => {
    const other = zone === 'header' ? 'info' : 'header'
    const row = zonesRef.current[zone].find(candidate => candidate.id === id)
    if (!row) return
    commit({
      ...zonesRef.current,
      [zone]: zonesRef.current[zone].filter(candidate => candidate.id !== id),
      [other]: [...zonesRef.current[other], row],
    }, [zone, other])
  }

  const addRow = (zone, row) => {
    commit({ ...zonesRef.current, [zone]: [...zonesRef.current[zone], { id: nextRowId(), ...row }] }, [zone])
  }

  const reorderZone = (zone, orderedIds) => {
    const byId = new Map(zonesRef.current[zone].map(row => [row.id, row]))
    commit({ ...zonesRef.current, [zone]: orderedIds.map(id => byId.get(id)).filter(Boolean) }, [zone])
  }

  // The parent removes the spec keys and remounts this component, which then
  // re-reads the post-reset effective rows (whole-kitchen spec, or the shipped
  // default resolved at print time).
  const resetToDefault = () => onReset()
  const startCustomizing = () => commit(zonesRef.current, ['header', 'info'])

  const usedFields = useMemo(() => ({
    header: new Set(zones.header.filter(row => row.type === 'field').map(row => row.field)),
    info: new Set(zones.info.filter(row => row.type === 'field').map(row => row.field)),
  }), [zones])

  const renderRow = zone => (id, { handleProps }) => {
    const row = zones[zone].find(candidate => candidate.id === id)
    if (!row) return null
    const structural = row.type === 'divider' || row.type === 'spacer'
    const isPair = row.type === 'pair'
    const onlyWhen = Array.isArray(row.only_when) && row.only_when.length ? row.only_when : null
    return (
      <div className={`mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 ${structural ? 'opacity-80' : ''}`}>
        <DragHandle handleProps={handleProps} />
        <span className="min-w-[92px] text-xs font-semibold text-dash-cream">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-dash-tertiary">
            {ROW_TYPE_LABELS[row.type] || row.type}
          </span>
          {row.type === 'field' ? fieldLabel(row.field) : ''}
          {isPair && (
            <span className="block font-normal text-[11px] text-dash-tertiary">
              {ticketTopSideLabel(row.left, fieldLabel)} → {ticketTopSideLabel(row.right, fieldLabel)}
            </span>
          )}
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
        {isPair && (
          <div className="grid w-full min-w-0 gap-2 md:grid-cols-2">
            <ColumnEditor side={row.left} label="Left" onChange={next => updateRow(zone, id, { left: next })} />
            <ColumnEditor side={row.right} label="Right" onChange={next => updateRow(zone, id, { right: next })} />
            <label className="flex min-w-0 items-center gap-1.5 justify-self-start rounded-lg border border-white/10 bg-black/15 px-2 py-1.5 md:col-span-2 md:justify-self-end" title="How many columns the right side reserves. Narrower leaves more room for the left.">
              <span className="font-mono text-[9px] uppercase tracking-wider text-dash-tertiary">Right width</span>
              <input
                type="number"
                min={3}
                max={20}
                value={row.right_width ?? 10}
                onChange={event => updateRow(zone, id, { right_width: Number(event.target.value) })}
                className="w-14 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-center text-xs text-dash-cream outline-none focus:border-dash-gold/60"
              />
            </label>
          </div>
        )}
        {row.type === 'divider' && <span className="min-w-[60px] flex-1 border-t border-dashed border-white/20" />}
        <span className="flex w-full min-w-0 flex-wrap items-center justify-end gap-1.5">
          {!structural && !isPair && (
            <>
              <MiniSelect value={row.size || 'standard'} onChange={value => updateRow(zone, id, { size: value })} title="Row size">
                <option value="standard">Standard</option>
                <option value="large">Large · tall</option>
                <option value="double">Double · wide</option>
              </MiniSelect>
              <Chip on={row.bold === true} title="Bold" onClick={() => updateRow(zone, id, { bold: !row.bold })}>B</Chip>
              <MiniSelect
                value={row.align || (zone === 'header' ? 'center' : 'left')}
                onChange={value => updateRow(zone, id, { align: value })}
                title="Alignment — header rows centre by default, info rows run left"
              >
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </MiniSelect>
              <Chip
                on={row.color === 'red'}
                tone="red"
                title={supportsRed === false ? 'This printer has no red ribbon — prints bold black instead' : 'Red — impact printer ribbon; thermal falls back to bold black'}
                onClick={() => updateRow(zone, id, { color: row.color === 'red' ? 'black' : 'red' })}
              >
                Red
              </Chip>
            </>
          )}
          {!structural && (
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
          )}
          <MiniSelect
            value={row.requires || ''}
            onChange={value => updateRow(zone, id, { requires: value || undefined })}
            title="Only print this row when a field has a value — e.g. a rule under the course banner should vanish on an uncoursed ticket"
          >
            <option value="">Always print</option>
            {Object.entries(TICKET_TOP_FIELDS).map(([field, meta]) => (
              <option key={field} value={field}>Only if: {meta.label}</option>
            ))}
          </MiniSelect>
          <button
            type="button"
            title={zone === 'header' ? 'Move to info block' : 'Move to header'}
            onClick={() => moveRow(zone, id)}
            className="rounded-lg border border-white/10 p-1.5 text-dash-tertiary transition hover:border-dash-gold/60 hover:text-dash-gold"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
          </button>
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
        {STANDALONE_FIELDS.map(([field, meta]) => (
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
        <button
          type="button"
          title="Two fields side by side on one line — the shape the printed heading uses"
          onClick={() => addRow(zone, structuredClone(NEW_PAIR_ROW))}
          className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold"
        >
          + Two columns
        </button>
        <button type="button" onClick={() => addRow(zone, { type: 'text', text: '' })} className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold">+ Custom text</button>
        <button type="button" onClick={() => addRow(zone, { type: 'divider' })} className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold">+ Divider</button>
        <button type="button" onClick={() => addRow(zone, { type: 'spacer' })} className="rounded-full border border-dashed border-white/15 px-3 py-1 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold">+ Spacer</button>
      </div>
    </div>
  )

  if (!configured) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Ticket header &amp; info</h2>
        <p className="mt-1 text-sm text-dash-tertiary">
          Using the standard ticket top — order method centered, station and server on the left, sent time on the right, then the table centered between single-width rules. Improvements to it reach you automatically until you customize.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-[11px] leading-5 text-dash-secondary">
{`             DINE IN
Kitchen · Marcus          3:14 PM
--------------------------------
            TABLE 12
--------------------------------`}
        </pre>
        <button
          type="button"
          onClick={startCustomizing}
          className="mt-4 rounded-xl border border-dash-gold/50 bg-dash-gold/10 px-4 py-2.5 text-sm font-semibold text-dash-gold transition hover:bg-dash-gold/15"
        >
          Customize ticket top
        </button>
        <p className="mt-2 text-xs text-dash-tertiary">
          Customizing starts from an exact copy of the ticket above, so nothing changes until you change it. You stop receiving updates to the standard layout. Review the live preview before saving.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ticket header &amp; info</h2>
          <p className="mt-1 text-sm text-dash-tertiary">
            {inherited
              ? 'Inherited from Whole Kitchen. Editing a row creates a station override only for that zone.'
              : 'Customized ticket top. Rows print in this order; empty fields skip automatically.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canReset && (
            <button
              type="button"
              onClick={resetToDefault}
              title={stationScoped ? 'Remove station overrides and use the Whole Kitchen ticket top' : 'Remove customization and go back to the standard ticket top, updates included'}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-gold"
            >
              <RotateCcw className="h-3 w-3" /> {stationScoped ? 'Use Whole Kitchen' : 'Use the standard'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="label-mono">Header</span>
          <span className="text-xs text-dash-tertiary">the line a cook reads first</span>
        </div>
        <div className="mt-2">
          <SortableRows ids={zones.header.map(row => row.id)} onReorder={ids => reorderZone('header', ids)} renderRow={renderRow('header')} />
        </div>
        {renderAddZone('header')}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline gap-2">
          <span className="label-mono">Info block</span>
          <span className="text-xs text-dash-tertiary">compact lines — table, server, course…</span>
        </div>
        <div className="mt-2">
          <SortableRows ids={zones.info.map(row => row.id)} onReorder={ids => reorderZone('info', ids)} renderRow={renderRow('info')} />
        </div>
        {renderAddZone('info')}
      </div>

      <p className="mt-3 text-xs text-dash-tertiary">
        Check memo is a whole-check kitchen instruction. Move and style it like any row, or use its label and value inside a two-column row. If every memo field is removed or hidden for an order method, the compact memo safely returns immediately before the items. CHANGE and CANCEL / HOLD corrections always use the fixed safety banner.
      </p>
    </div>
  )
}
