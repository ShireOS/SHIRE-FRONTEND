import { useId, useMemo, useState } from 'react'

// Shared primitives for the Menu workspace (MenuPanel + MenuItemDetail),
// mirroring the setup-panel visual idiom.

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Same palette the Pike POS uses for its device-side category colors.
export const MENU_COLOR_SWATCHES = [
  { hex: '#5087BE', name: 'Steel Blue' },
  { hex: '#6E5A9C', name: 'Plum' },
  { hex: '#4BA05A', name: 'Fern Green' },
  { hex: '#B5654A', name: 'Terracotta' },
  { hex: '#3D3E72', name: 'Midnight' },
  { hex: '#D67A3C', name: 'Amber' },
  { hex: '#579090', name: 'Teal' },
  { hex: '#827D6E', name: 'Stone' },
]

export const menuColorName = (hex) => {
  if (!hex) return null
  const match = MENU_COLOR_SWATCHES.find(swatch => swatch.hex.toLowerCase() === String(hex).toLowerCase())
  return match ? match.name : hex
}

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
  const selected = value ? MENU_COLOR_SWATCHES.find(swatch => swatch.hex.toLowerCase() === String(value).toLowerCase()) : null
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {MENU_COLOR_SWATCHES.map(swatch => {
          const isSelected = selected?.hex === swatch.hex
          return (
            <button
              key={swatch.hex}
              type="button"
              disabled={disabled}
              onClick={() => onPick(isSelected ? null : swatch.hex)}
              title={isSelected ? `${swatch.name} · ${swatch.hex} — click to clear` : `${swatch.name} · ${swatch.hex}`}
              aria-label={`${swatch.name} ${swatch.hex}`}
              className={[
                'h-7 w-7 rounded-full border-2 transition disabled:opacity-40',
                isSelected
                  ? 'scale-110 border-dash-gold ring-2 ring-dash-gold/40 ring-offset-2 ring-offset-black/60'
                  : 'border-white/20 hover:scale-105 hover:border-white/50',
              ].join(' ')}
              style={{ backgroundColor: swatch.hex }}
            />
          )
        })}
      </div>
      <span className="text-xs text-dash-tertiary">
        {selected
          ? <><span className="font-semibold text-dash-secondary">{selected.name}</span> · {selected.hex}</>
          : value
            ? <><span className="font-semibold text-dash-secondary">Custom</span> · {value}</>
            : 'No color — POS uses its default tile.'}
      </span>
    </div>
  )
}

// How this button will actually render on the POS order screen: a solid
// colored tile with the name (and optionally price) on it.
export function PosTilePreview({ color, label, sublabel, size = 'md' }) {
  const sizing = size === 'sm' ? 'h-12 w-20 rounded-lg p-1.5' : 'h-16 w-28 rounded-xl p-2'
  if (!color) {
    return (
      <div className={`flex ${sizing} flex-col justify-between border border-dashed border-white/20 bg-white/[0.04]`}>
        <span className={`line-clamp-2 font-semibold leading-tight text-dash-secondary ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{label || '—'}</span>
        {sublabel && <span className="text-[10px] text-dash-tertiary">{sublabel}</span>}
      </div>
    )
  }
  return (
    <div className={`flex ${sizing} flex-col justify-between shadow-lg`} style={{ backgroundColor: color }}>
      <span className={`line-clamp-2 font-semibold leading-tight text-white ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{label || '—'}</span>
      {sublabel && <span className="text-[10px] font-medium text-white/80">{sublabel}</span>}
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

// Searchable multi-select over menu items (attach modifiers/groups to items),
// grouped by category. When `onBulk(ids, shouldSelect)` is provided, each
// category header gets an "All"/"None" toggle so a group can be attached to
// e.g. every sandwich in one click.
export function ItemChecklist({ menuItems, selectedIds, onToggle, onBulk }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return menuItems
    return menuItems.filter(item =>
      item.name.toLowerCase().includes(needle) || (item.category || '').toLowerCase().includes(needle))
  }, [menuItems, query])
  const buckets = useMemo(() => {
    const map = {}
    for (const item of filtered) {
      ;(map[item.category || 'Other'] ||= []).push(item)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="space-y-2">
      <TextInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Search items or categories..." />
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
        {filtered.length === 0 && <p className="p-2 text-sm text-dash-tertiary">No items match.</p>}
        {buckets.map(([categoryName, bucketItems]) => {
          const selectedCount = bucketItems.filter(item => selectedIds.has(item.id)).length
          const allSelected = selectedCount === bucketItems.length
          return (
            <div key={categoryName}>
              <div className="mb-1 flex items-center gap-2 px-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-tertiary">{categoryName}</span>
                <span className="text-[11px] text-dash-tertiary">{selectedCount}/{bucketItems.length}</span>
                {onBulk && (
                  <button
                    type="button"
                    onClick={() => onBulk(bucketItems.map(item => item.id), !allSelected)}
                    className="text-[11px] font-semibold text-dash-gold/90 transition hover:text-dash-gold"
                  >
                    {allSelected ? 'Remove all' : `Select all ${bucketItems.length}`}
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {bucketItems.map(item => {
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
                      <span className="text-xs text-dash-tertiary">{selected ? '✓ attached' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>
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

// The category a new modifier should default to inside a group: whatever
// category most of the group's existing options live in, else the fallback
// (usually the group's own name).
export function dominantModifierCategory(options, modifiersById, fallback = '') {
  const counts = {}
  for (const option of options || []) {
    const modifier = modifiersById[option.modifier_id]
    if (!modifier) continue
    const category = modifierCategoryOf(modifier)
    counts[category] = (counts[category] || 0) + 1
  }
  let best = ''
  let bestCount = 0
  for (const [category, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }
  return best || fallback
}

// One picker for pulling modifiers in anywhere — onto an item or nested inside
// another modifier. Three moves in one place: click an existing modifier
// (bucketed by category), add a whole category at once, or create a brand-new
// modifier inline (typing a new category name creates that category too).
export function ModifierPicker({ modifiers, excludeIds, busy = false, onAddExisting, onCreateNew, autoFocus = false, defaultCategory = '', extraCategoryNames = [] }) {
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState({ name: '', price: '', category: defaultCategory })
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
    () => Array.from(new Set([
      ...modifiers.map(modifierCategoryOf),
      ...extraCategoryNames.map(name => (name || '').trim()).filter(Boolean),
    ])).sort(),
    [modifiers, extraCategoryNames],
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
        <SmallButton
          variant={showNew ? 'secondary' : 'primary'}
          onClick={() => {
            setShowNew(current => !current)
            setDraft(prev => ({ ...prev, category: prev.category || defaultCategory }))
          }}
        >
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
