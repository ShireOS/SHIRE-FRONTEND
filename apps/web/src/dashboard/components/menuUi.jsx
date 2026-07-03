import { useMemo, useState } from 'react'

// Shared primitives for the Menu workspace (MenuPanel + MenuItemDetail),
// mirroring the setup-panel visual idiom.

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Same palette the Pike POS uses for its device-side category colors.
export const MENU_COLOR_SWATCHES = [
  '#5087BE', '#6E5A9C', '#4BA05A', '#B5654A', '#3D3E72', '#D67A3C', '#579090', '#827D6E',
]

export const money = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `$${parsed.toFixed(2)}` : '—'
}

export const cleanDecimal = (value) => value.replace(/[^\d.]/g, '').slice(0, 8)
export const cleanDigits = (value, max = 3) => value.replace(/\D/g, '').slice(0, max)

export function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  )
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-dash-gold/70',
        props.className || '',
      ].join(' ')}
    />
  )
}

export function TextAreaInput(props) {
  return (
    <textarea
      {...props}
      className={[
        'min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-dash-gold/70',
        props.className || '',
      ].join(' ')}
    />
  )
}

export function SelectInput(props) {
  return (
    <select
      {...props}
      className={[
        'w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-dash-cream outline-none transition focus:border-dash-gold/70',
        props.className || '',
      ].join(' ')}
    />
  )
}

export function SmallButton({ children, onClick, variant = 'secondary', disabled = false, title }) {
  const classes = variant === 'primary'
    ? 'bg-dash-gold text-black hover:opacity-90'
    : variant === 'danger'
      ? 'border border-red-400/30 text-red-200 hover:border-red-300/60'
      : 'border border-white/10 text-dash-secondary hover:border-dash-gold/60 hover:text-dash-cream'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${classes}`}
    >
      {children}
    </button>
  )
}

export function SectionShell({ title, description, children, actions }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function MenuEmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-dash-secondary">{children}</p>
    </div>
  )
}

export function ColorSwatchPicker({ value, onPick, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {MENU_COLOR_SWATCHES.map(color => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          onClick={() => onPick(value === color ? null : color)}
          title={value === color ? 'Clear color' : color}
          className={[
            'h-6 w-6 rounded-full border-2 transition disabled:opacity-40',
            value === color ? 'border-dash-gold scale-110' : 'border-transparent hover:scale-105',
          ].join(' ')}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

// Small square thumbnail for item rows: photo if present, else a colored tile
// with the item's initial (colored by its category color when set).
export function ItemThumb({ item, color }) {
  if (item.image_url) {
    return <img src={item.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
  }
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white/85"
      style={{ backgroundColor: color ? `${color}55` : 'rgba(255,255,255,0.08)' }}
    >
      {(item.name || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

// Searchable multi-select over menu items (attach modifiers/groups to items).
export function ItemChecklist({ menuItems, selectedIds, onToggle }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return menuItems
    return menuItems.filter(item =>
      item.name.toLowerCase().includes(needle) || (item.category || '').toLowerCase().includes(needle))
  }, [menuItems, query])

  return (
    <div className="space-y-2">
      <TextInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Search items..." />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
        {filtered.length === 0 && <p className="p-2 text-sm text-dash-tertiary">No items match.</p>}
        {filtered.map(item => {
          const selected = selectedIds.has(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={[
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition',
                selected ? 'bg-dash-gold/15 text-dash-cream' : 'text-dash-secondary hover:bg-white/[0.05]',
              ].join(' ')}
            >
              <span>{item.name}</span>
              <span className="text-xs text-dash-tertiary">{item.category}{selected ? ' · ✓' : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// One-line plain-English recap of a group's selection + pricing rules, so the
// numbers always read as a sentence somewhere.
export function groupRulesSummary(group) {
  const min = Number(group.min_selections) || 0
  const max = group.max_selections == null || group.max_selections === '' ? null : Number(group.max_selections)
  const included = Number(group.included_count) || 0
  const overage = group.overage_price == null || group.overage_price === '' ? null : Number(group.overage_price)
  const parts = []
  parts.push(group.is_required ? 'Required' : 'Optional')
  if (max != null && max === min) parts.push(`pick exactly ${min}`)
  else if (max != null) parts.push(`pick ${min}–${max}`)
  else if (min > 0) parts.push(`pick at least ${min}`)
  else parts.push('pick any')
  if (included > 0) parts.push(`first ${included} free${overage != null ? `, then ${money(overage)} each` : ''}`)
  else if (overage != null) parts.push(`${money(overage)} per extra`)
  return parts.join(' · ')
}
