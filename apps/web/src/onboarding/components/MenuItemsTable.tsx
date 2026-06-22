export interface MenuEditorItem {
  id: string
  name: string
  category: string
  price: string
  description: string
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
}

export function MenuItemsTable({ items, onItemsChange, disabled }: MenuItemsTableProps) {
  const update = (id: string, field: keyof MenuEditorItem, value: string) => {
    onItemsChange(items.map(item => item.id === id ? { ...item, [field]: value } : item))
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
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[28%]">Name*</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[18%]">Category</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs w-[12%]">Price</th>
            <th className="text-left py-2 px-3 text-[rgb(var(--text-tertiary))] font-medium text-xs">Description</th>
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

              {/* Category */}
              <td className="py-1.5 px-2">
                <select
                  value={item.category}
                  onChange={(e) => update(item.id, 'category', e.target.value)}
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
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ background: '#1a1a1a', color: '#fff' }}>
                      {cat || '— Select —'}
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
