import { useEffect, useMemo, useState } from 'react'
import { fetchWithSupabaseAuth } from '../../shared/query'

const ACTION_LABELS = {
  discount: 'Discounts',
  comp: 'Comps',
  item_void: 'Item voids',
  check_void: 'Check voids',
}

const ACTION_ORDER = ['discount', 'comp', 'item_void', 'check_void']

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
      const data = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reason-presets?include_inactive=true`)
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
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reason-presets`, {
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
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/reason-presets/${preset.id}`, { method: 'DELETE' })
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

      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5">
        <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
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
