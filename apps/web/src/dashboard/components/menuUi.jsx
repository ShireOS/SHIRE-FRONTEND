import { useId, useMemo, useState } from 'react'

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

// Modifier "categories" are the group_name label on each modifier (defaults
// to "Add-ons" server-side). Typing a new label anywhere creates the category.
export const modifierCategoryOf = (modifier) => ((modifier?.group_name || '').trim() || 'Add-ons')

export function bucketModifiersByCategory(modifiers) {
  const buckets = {}
  for (const modifier of modifiers) {
    ;(buckets[modifierCategoryOf(modifier)] ||= []).push(modifier)
  }
  return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))
}

// One picker for pulling modifiers in anywhere — onto an item or nested inside
// another modifier. Three moves in one place: click an existing modifier
// (bucketed by category), add a whole category at once, or create a brand-new
// modifier inline (typing a new category name creates that category too).
export function ModifierPicker({ modifiers, excludeIds, busy = false, onAddExisting, onCreateNew, autoFocus = false }) {
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ name: '', price: '', category: '' })
  const categoryListId = useId()

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return modifiers.filter(modifier => {
      if (excludeIds?.has(modifier.id)) return false
      if (!needle) return true
      return modifier.name.toLowerCase().includes(needle)
        || modifierCategoryOf(modifier).toLowerCase().includes(needle)
    })
  }, [modifiers, excludeIds, query])
  const buckets = useMemo(() => bucketModifiersByCategory(available), [available])
  const categoryNames = useMemo(
    () => Array.from(new Set(modifiers.map(modifierCategoryOf))).sort(),
    [modifiers],
  )

  const submitNew = () => {
    if (!draft.name.trim()) return
    onCreateNew({
      name: draft.name.trim(),
      price_delta: draft.price === '' ? 0 : Number(draft.price),
      group_name: draft.category.trim() || 'Add-ons',
    })
    setDraft(prev => ({ name: '', price: '', category: prev.category }))
    setShowNew(false)
  }

  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1">
          <TextInput
            autoFocus={autoFocus}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search modifiers or categories..."
            className="!py-2"
          />
        </div>
        <SmallButton variant={showNew ? 'secondary' : 'primary'} onClick={() => setShowNew(current => !current)}>
          {showNew ? 'Cancel' : '+ New modifier'}
        </SmallButton>
      </div>

      {showNew && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dash-gold/25 bg-white/[0.02] p-2">
          <div className="w-44">
            <TextInput
              autoFocus
              value={draft.name}
              onChange={event => setDraft(prev => ({ ...prev, name: event.target.value }))}
              onKeyDown={event => { if (event.key === 'Enter') submitNew() }}
              placeholder="Ranch"
              className="!py-2"
            />
          </div>
          <div className="w-24">
            <TextInput
              inputMode="decimal"
              value={draft.price}
              onChange={event => setDraft(prev => ({ ...prev, price: cleanDecimal(event.target.value) }))}
              onKeyDown={event => { if (event.key === 'Enter') submitNew() }}
              placeholder="+$ 0.00"
              className="!py-2"
            />
          </div>
          <div className="w-44">
            <TextInput
              list={categoryListId}
              value={draft.category}
              onChange={event => setDraft(prev => ({ ...prev, category: event.target.value }))}
              onKeyDown={event => { if (event.key === 'Enter') submitNew() }}
              placeholder="Category (or new one)"
              className="!py-2"
            />
            <datalist id={categoryListId}>
              {categoryNames.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>
          <SmallButton variant="primary" disabled={!draft.name.trim() || busy} onClick={submitNew}>Create & add</SmallButton>
        </div>
      )}

      <div className="mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
        {buckets.map(([categoryName, bucketModifiers]) => (
          <div key={categoryName}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{categoryName}</span>
              <span className="text-xs text-dash-tertiary">{bucketModifiers.length}</span>
              {bucketModifiers.length > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAddExisting(bucketModifiers.map(modifier => modifier.id))}
                  className="text-xs font-semibold text-dash-gold/90 transition hover:text-dash-gold disabled:opacity-50"
                >
                  Add all {bucketModifiers.length}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bucketModifiers.map(modifier => (
                <button
                  key={modifier.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onAddExisting([modifier.id])}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-dash-secondary transition hover:border-dash-gold/60 hover:text-dash-cream disabled:opacity-50"
                >
                  + {modifier.name}
                  {Number(modifier.price_delta) > 0 && <span className="ml-1 text-xs text-dash-tertiary">{money(modifier.price_delta)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        {buckets.length === 0 && (
          <p className="py-2 text-sm text-dash-tertiary">
            {modifiers.length === 0 ? 'No modifiers yet — create your first one above.' : 'Nothing matches — clear the search or create it new.'}
          </p>
        )}
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
