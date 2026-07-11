import { useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../../auth'
import { createStoreGroup, deleteStoreGroup, setGroupMembership } from '../data/storeGroups'

export default function StoreGroupsModal({ groups, restaurants, onClose, onChanged }) {
  const auth = useAuth()
  const [newName, setNewName] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [error, setError] = useState(null)

  const run = async (key, fn) => {
    setBusyKey(key)
    setError(null)
    try {
      await fn()
      await onChanged()
    } catch (runError) {
      setError(runError?.message || 'Something went wrong.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="glass-card max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-dash-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono">Organize</p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-dash-cream">Store groups</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-dash-tertiary transition hover:bg-[var(--glass-bg-hover)] hover:text-dash-cream"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && newName.trim()) {
                void run('create', async () => {
                  await createStoreGroup(auth.user.id, newName.trim())
                  setNewName('')
                })
              }
            }}
            placeholder="New group — e.g. Downtown, Franchise East"
            className="w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
          />
          <button
            type="button"
            disabled={!newName.trim() || busyKey === 'create'}
            onClick={() => void run('create', async () => {
              await createStoreGroup(auth.user.id, newName.trim())
              setNewName('')
            })}
            className="flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl bg-shell-cta px-3 text-sm font-semibold text-shell-cta-text transition hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            Add
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-dash-danger">{error}</p>}

        <div className="mt-4 space-y-4">
          {groups.length === 0 && (
            <p className="text-sm text-dash-tertiary">No groups yet — create one above, then toggle stores into it.</p>
          )}
          {groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-dash-border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-dash-cream">{group.name}</p>
                <button
                  type="button"
                  disabled={busyKey === `delete:${group.id}`}
                  onClick={() => void run(`delete:${group.id}`, () => deleteStoreGroup(group.id))}
                  aria-label={`Delete group ${group.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-dash-tertiary transition hover:text-dash-danger"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {restaurants.map((restaurant) => {
                  const isMember = group.restaurantIds.has(restaurant.id)
                  const key = `${group.id}:${restaurant.id}`
                  return (
                    <button
                      key={restaurant.id}
                      type="button"
                      disabled={busyKey === key}
                      aria-pressed={isMember}
                      onClick={() => void run(key, () => setGroupMembership(group.id, restaurant.id, !isMember))}
                      className={[
                        'flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition disabled:opacity-50',
                        isMember
                          ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent'
                          : 'border-dash-border text-dash-tertiary hover:text-dash-secondary',
                      ].join(' ')}
                    >
                      {isMember && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                      {restaurant.name || 'Untitled'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
