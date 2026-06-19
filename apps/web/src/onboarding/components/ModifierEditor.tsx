import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import type { MenuEditorItem } from './MenuItemsTable'

// ── Types ──────────────────────────────────────────────────────────────────

interface LocalModifier {
  localId: string       // stable client-side key
  savedId: string | null
  name: string
  priceDelta: string    // string for controlled input, parsed on save
  itemIds: Set<string>  // menu item UUIDs
}

interface ModifierEditorProps {
  restaurantId: string
  menuItems: MenuEditorItem[]   // items saved in previous step
  onBack: () => void
  onDone: () => void            // advance onboarding
}

// ── API helpers ────────────────────────────────────────────────────────────

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : ''
}

const base = (restaurantId: string) =>
  `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/menu/modifiers`

// ── Main component ─────────────────────────────────────────────────────────

export function ModifierEditor({ restaurantId, menuItems, onBack, onDone }: ModifierEditorProps) {
  const [modifiers, setModifiers] = useState<LocalModifier[]>([])
  const [deletedModifierIds, setDeletedModifierIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [popupFor, setPopupFor] = useState<string | null>(null) // localId of open popup

  // Load existing modifiers on mount (survive back-navigation)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const token = await getToken()
        const res = await fetch(base(restaurantId), { headers: { Authorization: token } })
        if (!res.ok) return
        const data: { id: string; name: string; price_delta: number; item_ids: string[] }[] = await res.json()
        setModifiers(data.map(m => ({
          localId: m.id,
          savedId: m.id,
          name: m.name,
          priceDelta: m.price_delta > 0 ? String(m.price_delta) : '',
          itemIds: new Set(m.item_ids),
        })))
        setDeletedModifierIds(new Set())
      } catch {
        // silently fall through — start with empty list
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [restaurantId])

  const addRow = () => {
    setModifiers(prev => [
      ...prev,
      { localId: crypto.randomUUID(), savedId: null, name: '', priceDelta: '', itemIds: new Set() },
    ])
  }

  const updateRow = useCallback((localId: string, patch: Partial<Pick<LocalModifier, 'name' | 'priceDelta'>>) => {
    setModifiers(prev => prev.map(m => m.localId === localId ? { ...m, ...patch } : m))
  }, [])

  const removeRow = useCallback((localId: string) => {
    const removed = modifiers.find(m => m.localId === localId)
    if (removed?.savedId) {
      setDeletedModifierIds(ids => new Set(ids).add(removed.savedId!))
    }
    setModifiers(prev => prev.filter(m => m.localId !== localId))
  }, [modifiers])

  const setItemIds = useCallback((localId: string, ids: Set<string>) => {
    setModifiers(prev => prev.map(m => m.localId === localId ? { ...m, itemIds: new Set(ids) } : m))
  }, [])

  const handleSave = async () => {
    const valid = modifiers.filter(m => m.name.trim() !== '')
    if (valid.length === 0 && deletedModifierIds.size === 0) { onDone(); return }

    setSaving(true)
    setError(null)
    try {
      const token = await getToken()

      for (const mod of valid) {
        const delta = parseFloat(mod.priceDelta) || 0
        let savedId = mod.savedId

        if (!savedId) {
          // Create
          const res = await fetch(base(restaurantId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: token },
            body: JSON.stringify({ name: mod.name.trim(), price_delta: delta }),
          })
          if (!res.ok) throw new Error(`Failed to create modifier "${mod.name}"`)
          const created: { id: string } = await res.json()
          savedId = created.id
        } else {
          // Update name/price
          await fetch(`${base(restaurantId)}/${savedId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: token },
            body: JSON.stringify({ name: mod.name.trim(), price_delta: delta }),
          })
        }

        // Replace item assignments
        await fetch(`${base(restaurantId)}/${savedId}/items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ item_ids: Array.from(mod.itemIds) }),
        })
      }

      for (const modifierId of deletedModifierIds) {
        const res = await fetch(`${base(restaurantId)}/${modifierId}`, {
          method: 'DELETE',
          headers: { Authorization: token },
        })
        if (!res.ok) throw new Error('Failed to delete removed modifier')
      }

      setDeletedModifierIds(new Set())
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const validCount = modifiers.filter(m => m.name.trim() !== '').length
  const popupModifier = modifiers.find(m => m.localId === popupFor) ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgb(var(--gold))]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="text-center">
          <h2 className="text-[rgb(var(--text-primary))] font-semibold text-sm">Menu Modifiers</h2>
          <p className="text-[rgb(var(--text-tertiary))] text-xs mt-0.5">
            Add-ons like "Extra Cheese" or "Gluten Free" — then assign which items offer them
          </p>
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : validCount > 0 ? `Save & Continue` : 'Skip'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_140px_32px] gap-3 px-4 py-2.5 border-b border-[rgba(255,255,255,0.06)] text-[10px] uppercase tracking-wider text-[rgb(var(--text-tertiary))]">
          <span>Modifier Name</span>
          <span>Price Add-on</span>
          <span>Applies To</span>
          <span />
        </div>

        {modifiers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-[rgb(var(--text-tertiary))]">
            <svg className="w-8 h-8 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-sm">No modifiers yet — add one below</p>
          </div>
        )}

        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {modifiers.map(mod => (
            <ModifierRow
              key={mod.localId}
              modifier={mod}
              menuItemCount={menuItems.length}
              onUpdate={(patch) => updateRow(mod.localId, patch)}
              onRemove={() => removeRow(mod.localId)}
              onOpenPopup={() => setPopupFor(mod.localId)}
              disabled={saving}
            />
          ))}
        </div>
      </div>

      {/* Add row button */}
      <div className="mt-3">
        <button
          onClick={addRow}
          disabled={saving}
          className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Modifier
        </button>
      </div>

      {/* Item assignment popup */}
      {popupFor && popupModifier && (
        <ItemAssignmentPopup
          modifier={popupModifier}
          menuItems={menuItems}
          onConfirm={(ids) => {
            setItemIds(popupFor, ids)
            setPopupFor(null)
          }}
        />
      )}
    </div>
  )
}

// ── Modifier Row ───────────────────────────────────────────────────────────

interface ModifierRowProps {
  modifier: LocalModifier
  menuItemCount: number
  onUpdate: (patch: Partial<Pick<LocalModifier, 'name' | 'priceDelta'>>) => void
  onRemove: () => void
  onOpenPopup: () => void
  disabled: boolean
}

function ModifierRow({ modifier, menuItemCount: _menuItemCount, onUpdate, onRemove, onOpenPopup, disabled }: ModifierRowProps) {
  const count = modifier.itemIds.size
  const assigned = count > 0

  return (
    <div className="grid grid-cols-[1fr_120px_140px_32px] gap-3 px-4 py-2.5 items-center">
      {/* Name */}
      <input
        type="text"
        value={modifier.name}
        onChange={e => onUpdate({ name: e.target.value })}
        disabled={disabled}
        placeholder="e.g. Extra Cheese"
        className="w-full px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-tertiary))] focus:outline-none focus:border-[rgba(201,169,98,0.4)] transition-colors disabled:opacity-50"
      />

      {/* Price delta */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--text-tertiary))]">+$</span>
        <input
          type="number"
          min="0"
          step="0.25"
          value={modifier.priceDelta}
          onChange={e => onUpdate({ priceDelta: e.target.value })}
          disabled={disabled}
          placeholder="0.00"
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-tertiary))] focus:outline-none focus:border-[rgba(201,169,98,0.4)] transition-colors disabled:opacity-50"
        />
      </div>

      {/* Status chip */}
      <button
        onClick={onOpenPopup}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          assigned
            ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
            : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] hover:border-[rgba(201,169,98,0.3)] hover:text-[rgb(var(--gold))]'
        } disabled:opacity-50`}
      >
        {assigned ? (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {count} item{count !== 1 ? 's' : ''}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-[rgba(255,255,255,0.2)]" />
            Assign items
          </>
        )}
      </button>

      {/* Delete */}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--text-tertiary))] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Item Assignment Popup ──────────────────────────────────────────────────

interface ItemAssignmentPopupProps {
  modifier: LocalModifier
  menuItems: MenuEditorItem[]
  onConfirm: (ids: Set<string>) => void
}

function ItemAssignmentPopup({ modifier, menuItems, onConfirm }: ItemAssignmentPopupProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(modifier.itemIds))

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(menuItems.map(i => i.id)))
  const clearAll = () => setSelected(new Set())

  // Group items by category
  const grouped = menuItems.reduce<Record<string, MenuEditorItem[]>>((acc, item) => {
    const cat = item.category || 'Uncategorized'
    ;(acc[cat] ??= []).push(item)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={() => onConfirm(selected)}
      />

      {/* Panel */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md max-h-[80vh] flex flex-col rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgb(var(--bg-panel))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0">
          <div>
            <p className="text-[rgb(var(--text-primary))] font-semibold text-sm">
              "{modifier.name || 'Modifier'}" applies to…
            </p>
            <p className="text-[rgb(var(--text-tertiary))] text-xs mt-0.5">
              {selected.size} of {menuItems.length} item{menuItems.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={() => onConfirm(selected)}
            className="text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))] transition-colors p-1 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Select all / clear */}
        <div className="flex gap-3 px-5 py-2.5 border-b border-[rgba(255,255,255,0.05)] flex-shrink-0">
          <button onClick={selectAll} className="text-xs text-[rgb(var(--gold))] hover:opacity-80 transition-opacity">
            Select all
          </button>
          <span className="text-[rgba(255,255,255,0.15)]">·</span>
          <button onClick={clearAll} className="text-xs text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-secondary))] transition-colors">
            Clear
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto py-2">
          {menuItems.length === 0 ? (
            <p className="text-center text-[rgb(var(--text-tertiary))] text-sm py-8">
              No items yet — add menu items first
            </p>
          ) : (
            categories.map(cat => (
              <div key={cat}>
                <p className="px-5 py-1.5 text-[10px] uppercase tracking-wider text-[rgb(var(--text-tertiary))] font-semibold">
                  {cat}
                </p>
                {grouped[cat].map(item => {
                  const checked = selected.has(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                        checked
                          ? 'bg-[rgba(201,169,98,0.08)]'
                          : 'hover:bg-[rgba(255,255,255,0.04)]'
                      }`}
                    >
                      {/* Checkbox */}
                      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
                        checked
                          ? 'bg-[rgb(var(--gold))] border-[rgb(var(--gold))]'
                          : 'border-[rgba(255,255,255,0.2)]'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm text-[rgb(var(--text-primary))]">{item.name}</span>
                      {item.price && (
                        <span className="ml-auto text-xs text-[rgb(var(--text-tertiary))]">
                          ${item.price}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Confirm */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.07)]">
          <button
            onClick={() => onConfirm(selected)}
            className="w-full py-2.5 bg-[rgb(var(--gold))] text-black text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Confirm — {selected.size} item{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  )
}
