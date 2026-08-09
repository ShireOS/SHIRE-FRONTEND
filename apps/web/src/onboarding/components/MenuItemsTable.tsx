import { SmartTimeInput } from '../../shared/components/SmartTimeInput'

export interface MenuEditorItem {
  id: string
  name: string
  category: string
  menu_category_id?: string
  price: string
  description: string
  is_available?: boolean
  availability_mode?: 'always' | 'schedule' | 'seasonal' | 'manual'
  availability_days?: number[]
  availability_start_time?: string
  availability_end_time?: string
  availability_service_modes?: string[]
  availability_start_date?: string
  availability_end_date?: string
  availability_notes?: string
  fire_mode?: 'inherit' | 'immediate' | 'hold' | 'manual' | 'by_course' | ''
  kds_display_group?: string
}

const CATEGORIES = [
  '',
  'Appetizers',
  'Soups & Salads',
  'Mains',
  'Pasta & Pizza',
  'Sandwiches & Burgers',
  'Sides',
  'Desserts',
  'Drinks',
  'Cocktails',
  'Beer & Wine',
  'Specials',
  'Other',
]

interface MenuItemsTableProps {
  items: MenuEditorItem[]
  onItemsChange: (items: MenuEditorItem[]) => void
  // Fired only for the explicit per-row delete button, so callers can tell a
  // deliberate removal apart from rows merely leaving the table state.
  onRemove?: (id: string) => void
  disabled?: boolean
  categories?: Array<{ id?: string | null; name: string; default_fire_mode?: string; kds_display_group?: string }>
}

const DAYS = [
  [0, 'Sun'],
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
] as const

const SERVICE_MODES = ['dine_in', 'bar', 'takeout', 'delivery', 'catering']
const FIRE_OPTIONS = [
  ['', 'Category default'],
  ['inherit', 'Default'],
  ['immediate', 'Immediate'],
  ['hold', 'Hold'],
  ['manual', 'Manual'],
  ['by_course', 'By course'],
] as const
const fieldClass = 'w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[rgb(var(--text-primary))] outline-none placeholder:text-[rgb(var(--text-tertiary))] focus:border-[rgba(201,169,98,0.65)]'
const compactFieldClass = 'w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-[rgb(var(--text-primary))] outline-none placeholder:text-[rgb(var(--text-tertiary))] focus:border-[rgba(201,169,98,0.65)]'

const sanitizePriceInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole
}

export function MenuItemsTable({ items, onItemsChange, onRemove, disabled, categories }: MenuItemsTableProps) {
  const categoryOptions = categories?.length ? [{ id: null, name: '' }, ...categories] : CATEGORIES.map(name => ({ id: null, name }))

  const update = (id: string, field: keyof MenuEditorItem, value: unknown) => {
    onItemsChange(items.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const updateCategory = (id: string, categoryName: string) => {
    const category = categories?.find(row => row.name === categoryName)
    onItemsChange(items.map(item => item.id === id ? {
      ...item,
      category: categoryName,
      menu_category_id: category?.id || undefined,
      fire_mode: (item.fire_mode || category?.default_fire_mode || '') as MenuEditorItem['fire_mode'],
      kds_display_group: item.kds_display_group || category?.kds_display_group || '',
    } : item))
  }

  const toggleNumber = (values: number[] | undefined, value: number) => {
    const current = values?.length ? values : [0, 1, 2, 3, 4, 5, 6]
    return current.includes(value) ? current.filter(item => item !== value) : [...current, value].sort((a, b) => a - b)
  }

  const toggleString = (values: string[] | undefined, value: string) => {
    const current = values || []
    return current.includes(value) ? current.filter(item => item !== value) : [...current, value]
  }

  const remove = (id: string) => {
    onRemove?.(id)
    onItemsChange(items.filter(item => item.id !== id))
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[rgb(var(--text-tertiary))] text-sm">
        No items yet. Click "+ Add Item" below to start.
      </div>
    )
  }

  return (
    <div className="w-full space-y-3 p-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(var(--text-tertiary))]">
              Item {index + 1}
            </p>
            <button
              type="button"
              onClick={() => remove(item.id)}
              disabled={disabled}
              className="rounded-md border border-red-400/25 px-2 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
            >
              Remove
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.65fr_0.9fr]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Name*</span>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => update(item.id, 'name', e.target.value)}
                  disabled={disabled}
                  placeholder="Item name"
                  className={fieldClass}
                />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Menu category</span>
                <select
                  value={item.category}
                  onChange={(e) => updateCategory(item.id, e.target.value)}
                  disabled={disabled}
                  className={fieldClass}
                >
                  {categoryOptions.map(cat => (
                    <option key={cat.id || cat.name || 'blank'} value={cat.name} style={{ background: '#1a1a1a', color: '#fff' }}>
                      {cat.name || '— Select —'}
                    </option>
                  ))}
                </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Price</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[rgb(var(--text-tertiary))]">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.price}
                    onChange={(e) => update(item.id, 'price', sanitizePriceInput(e.target.value))}
                    disabled={disabled}
                    placeholder="0.00"
                    className={fieldClass}
                  />
                </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Availability</span>
              <select
                value={item.availability_mode || 'always'}
                onChange={(e) => update(item.id, 'availability_mode', e.target.value)}
                disabled={disabled}
                className={fieldClass}
              >
                <option value="always" style={{ background: '#1a1a1a', color: '#fff' }}>Always</option>
                <option value="schedule" style={{ background: '#1a1a1a', color: '#fff' }}>By day/time</option>
                <option value="seasonal" style={{ background: '#1a1a1a', color: '#fff' }}>Seasonal</option>
                <option value="manual" style={{ background: '#1a1a1a', color: '#fff' }}>Manual/86 only</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block space-y-1">
            <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Description</span>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => update(item.id, 'description', e.target.value)}
                  disabled={disabled}
                  placeholder="Optional description"
                  className={fieldClass}
                />
          </label>

          {(item.availability_mode === 'schedule' || item.availability_mode === 'seasonal') && (
            <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
              {item.availability_mode === 'schedule' && (
                <>
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map(([value, label]) => {
                      const active = (item.availability_days || [0, 1, 2, 3, 4, 5, 6]).includes(value)
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={disabled}
                          onClick={() => update(item.id, 'availability_days', toggleNumber(item.availability_days, value))}
                          className={`rounded border px-2 py-1 text-[10px] ${active ? 'border-[rgb(var(--gold))] text-[rgb(var(--gold))]' : 'border-white/10 text-[rgb(var(--text-tertiary))]'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SmartTimeInput ariaLabel={`${item.name} available from`} value={item.availability_start_time || ''} disabled={disabled} onChange={(value) => update(item.id, 'availability_start_time', value)} inputClassName="!rounded-lg !py-2 !pr-2 !text-xs" />
                    <SmartTimeInput ariaLabel={`${item.name} available until`} value={item.availability_end_time || ''} disabled={disabled} onChange={(value) => update(item.id, 'availability_end_time', value)} inputClassName="!rounded-lg !py-2 !pr-2 !text-xs" />
                  </div>
                </>
              )}
              {item.availability_mode === 'seasonal' && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={item.availability_start_date || ''} disabled={disabled} onChange={(e) => update(item.id, 'availability_start_date', e.target.value)} className={compactFieldClass} />
                  <input type="date" value={item.availability_end_date || ''} disabled={disabled} onChange={(e) => update(item.id, 'availability_end_date', e.target.value)} className={compactFieldClass} />
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {SERVICE_MODES.map(mode => {
                  const active = (item.availability_service_modes || []).includes(mode)
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={disabled}
                      onClick={() => update(item.id, 'availability_service_modes', toggleString(item.availability_service_modes, mode))}
                      className={`rounded border px-2 py-1 text-[10px] capitalize ${active ? 'border-[rgb(var(--gold))] text-[rgb(var(--gold))]' : 'border-white/10 text-[rgb(var(--text-tertiary))]'}`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <details className="mt-3 rounded-lg border border-white/10 bg-black/15 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[rgb(var(--text-secondary))]">
              Advanced routing overrides
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-[rgb(var(--text-tertiary))]">Fire override</span>
                  <select
                    value={item.fire_mode || ''}
                    onChange={(e) => update(item.id, 'fire_mode', e.target.value)}
                    disabled={disabled}
                    className={compactFieldClass}
                  >
                    {FIRE_OPTIONS.map(([value, label]) => <option key={value} value={value} style={{ background: '#1a1a1a', color: '#fff' }}>{label}</option>)}
                  </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[rgb(var(--text-tertiary))]">KDS group</span>
                  <input
                    value={item.kds_display_group || ''}
                    onChange={(e) => update(item.id, 'kds_display_group', e.target.value)}
                    disabled={disabled}
                    placeholder="KDS group"
                    className={compactFieldClass}
                  />
              </label>
            </div>
          </details>
        </div>
      ))}
    </div>
  )
}
