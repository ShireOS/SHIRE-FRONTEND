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
  course_type?: 'none' | 'appetizer' | 'entree' | 'dessert' | 'drink' | 'side' | 'other' | ''
  fire_mode?: 'inherit' | 'immediate' | 'hold' | 'manual' | 'by_course' | ''
  routing_station_id?: string
  prep_time_minutes?: string
  kds_display_group?: string
  item_routing_notes?: string
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
  disabled?: boolean
  categories?: Array<{ id?: string | null; name: string; routing_station_id?: string; routing_station_name?: string; default_course_type?: string; default_fire_mode?: string; prep_time_minutes?: string; kds_display_group?: string }>
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
const COURSE_OPTIONS = [
  ['', 'Category default'],
  ['none', 'No course'],
  ['appetizer', 'App'],
  ['entree', 'Entree'],
  ['dessert', 'Dessert'],
  ['drink', 'Drink'],
  ['side', 'Side'],
  ['other', 'Other'],
] as const
const FIRE_OPTIONS = [
  ['', 'Category default'],
  ['inherit', 'Default'],
  ['immediate', 'Immediate'],
  ['hold', 'Hold'],
  ['manual', 'Manual'],
  ['by_course', 'By course'],
] as const

export function MenuItemsTable({ items, onItemsChange, disabled, categories }: MenuItemsTableProps) {
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
      routing_station_id: item.routing_station_id || category?.routing_station_id || undefined,
      course_type: (item.course_type || category?.default_course_type || '') as MenuEditorItem['course_type'],
      fire_mode: (item.fire_mode || category?.default_fire_mode || '') as MenuEditorItem['fire_mode'],
      prep_time_minutes: item.prep_time_minutes || category?.prep_time_minutes || '',
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
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.08)]">
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[22%]">Name*</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[16%]">Category</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[12%]">Price</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs">Description</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[16%]">Availability</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[16%]">Course / Routing</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            >
              {/* Name */}
              <td className="py-1.5 px-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => update(item.id, 'name', e.target.value)}
                  disabled={disabled}
                  placeholder="Item name"
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    color: 'rgb(var(--text-primary))',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(201,169,98,0.6)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </td>

              <td className="py-1.5 px-2">
                <select
                  value={item.category}
                  onChange={(e) => updateCategory(item.id, e.target.value)}
                  disabled={disabled}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    color: item.category ? 'rgb(var(--text-primary))' : 'rgb(var(--text-tertiary))',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {categoryOptions.map(cat => (
                    <option key={cat.id || cat.name || 'blank'} value={cat.name} style={{ background: '#1a1a1a', color: '#fff' }}>
                      {cat.name || '— Select —'}
                    </option>
                  ))}
                </select>
              </td>

              {/* Price */}
              <td className="py-1.5 px-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, color: 'rgb(var(--text-tertiary))' }}>$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.price}
                    onChange={(e) => update(item.id, 'price', e.target.value)}
                    disabled={disabled}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      fontSize: 13,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 4,
                      color: 'rgb(var(--text-primary))',
                      outline: 'none',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'rgba(201,169,98,0.6)')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                </div>
              </td>

              {/* Description */}
              <td className="py-1.5 px-2">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => update(item.id, 'description', e.target.value)}
                  disabled={disabled}
                  placeholder="Optional description"
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    color: 'rgb(var(--text-primary))',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(201,169,98,0.6)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </td>

              <td className="py-1.5 px-2 align-top">
                <select
                  value={item.availability_mode || 'always'}
                  onChange={(e) => update(item.id, 'availability_mode', e.target.value)}
                  disabled={disabled}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: 13,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    color: 'rgb(var(--text-primary))',
                    outline: 'none',
                  }}
                >
                  <option value="always" style={{ background: '#1a1a1a', color: '#fff' }}>Always</option>
                  <option value="schedule" style={{ background: '#1a1a1a', color: '#fff' }}>By day/time</option>
                  <option value="seasonal" style={{ background: '#1a1a1a', color: '#fff' }}>Seasonal</option>
                  <option value="manual" style={{ background: '#1a1a1a', color: '#fff' }}>Manual/86 only</option>
                </select>
                {(item.availability_mode === 'schedule' || item.availability_mode === 'seasonal') && (
                  <div className="mt-2 space-y-2">
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
                                className={`rounded border px-1.5 py-1 text-[10px] ${active ? 'border-[rgb(var(--gold))] text-[rgb(var(--gold))]' : 'border-white/10 text-[rgb(var(--text-tertiary))]'}`}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <input type="time" value={item.availability_start_time || ''} disabled={disabled} onChange={(e) => update(item.id, 'availability_start_time', e.target.value)} className="min-w-0 rounded border border-white/10 bg-white/[0.05] px-1 py-1 text-xs text-white" />
                          <input type="time" value={item.availability_end_time || ''} disabled={disabled} onChange={(e) => update(item.id, 'availability_end_time', e.target.value)} className="min-w-0 rounded border border-white/10 bg-white/[0.05] px-1 py-1 text-xs text-white" />
                        </div>
                      </>
                    )}
                    {item.availability_mode === 'seasonal' && (
                      <div className="grid grid-cols-2 gap-1">
                        <input type="date" value={item.availability_start_date || ''} disabled={disabled} onChange={(e) => update(item.id, 'availability_start_date', e.target.value)} className="min-w-0 rounded border border-white/10 bg-white/[0.05] px-1 py-1 text-xs text-white" />
                        <input type="date" value={item.availability_end_date || ''} disabled={disabled} onChange={(e) => update(item.id, 'availability_end_date', e.target.value)} className="min-w-0 rounded border border-white/10 bg-white/[0.05] px-1 py-1 text-xs text-white" />
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
                            className={`rounded border px-1.5 py-1 text-[10px] ${active ? 'border-[rgb(var(--gold))] text-[rgb(var(--gold))]' : 'border-white/10 text-[rgb(var(--text-tertiary))]'}`}
                          >
                            {mode.replace('_', ' ')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </td>

              <td className="py-1.5 px-2 align-top">
                <div className="space-y-2">
                  <select
                    value={item.course_type || ''}
                    onChange={(e) => update(item.id, 'course_type', e.target.value)}
                    disabled={disabled}
                    className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white"
                  >
                    {COURSE_OPTIONS.map(([value, label]) => <option key={value} value={value} style={{ background: '#1a1a1a', color: '#fff' }}>{label}</option>)}
                  </select>
                  <select
                    value={item.fire_mode || ''}
                    onChange={(e) => update(item.id, 'fire_mode', e.target.value)}
                    disabled={disabled}
                    className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white"
                  >
                    {FIRE_OPTIONS.map(([value, label]) => <option key={value} value={value} style={{ background: '#1a1a1a', color: '#fff' }}>{label}</option>)}
                  </select>
                  <input
                    value={item.kds_display_group || ''}
                    onChange={(e) => update(item.id, 'kds_display_group', e.target.value)}
                    disabled={disabled}
                    placeholder="KDS group"
                    className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white placeholder:text-[rgb(var(--text-tertiary))]"
                  />
                  <input
                    value={item.prep_time_minutes || ''}
                    onChange={(e) => update(item.id, 'prep_time_minutes', e.target.value.replace(/\D/g, '').slice(0, 3))}
                    disabled={disabled}
                    placeholder="Prep min"
                    className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white placeholder:text-[rgb(var(--text-tertiary))]"
                  />
                </div>
              </td>

              {/* Delete */}
              <td className="py-1.5 px-2 text-center">
                <button
                  onClick={() => remove(item.id)}
                  disabled={disabled}
                  style={{ fontSize: 14, color: 'rgb(var(--text-tertiary))', cursor: 'pointer', padding: '2px 4px' }}
                  title="Remove item"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
