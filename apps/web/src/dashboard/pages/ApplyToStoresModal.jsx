import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { APPLY_AREAS, applyToStores } from '../data/bulkApply'

function Pill({ isActive, onClick, disabled, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isActive}
      onClick={onClick}
      className={[
        'flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-40',
        isActive
          ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent'
          : 'border-dash-border text-dash-secondary hover:text-dash-cream',
      ].join(' ')}
    >
      {isActive && <Check size={11} strokeWidth={3} aria-hidden="true" />}
      {children}
    </button>
  )
}

export default function ApplyToStoresModal({ restaurants, groups, onClose }) {
  const [sourceId, setSourceId] = useState(restaurants[0]?.id || '')
  const [targetIds, setTargetIds] = useState(new Set())
  const [areaIds, setAreaIds] = useState(new Set(['taxes-charges', 'hours']))
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)

  const targets = useMemo(
    () => restaurants.filter((restaurant) => restaurant.id !== sourceId),
    [restaurants, sourceId]
  )

  const toggleSet = (set, value, setter) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  const selectGroup = (group) => {
    const next = new Set(targetIds)
    const groupTargets = targets.filter((t) => group.restaurantIds.has(t.id))
    const allIn = groupTargets.every((t) => next.has(t.id))
    for (const target of groupTargets) {
      if (allIn) next.delete(target.id)
      else next.add(target.id)
    }
    setTargetIds(next)
  }

  const run = async () => {
    setRunning(true)
    setResults(null)
    const outcome = await applyToStores({
      sourceId,
      targetIds: [...targetIds],
      areaIds: [...areaIds],
    })
    setResults(outcome)
    setRunning(false)
  }

  const failures = (results || []).filter((result) => !result.ok)
  const nameOf = (id) => restaurants.find((r) => r.id === id)?.name || 'Store'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="glass-card max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-dash-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono">One-time copy</p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-dash-cream">Apply to stores</h2>
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

        {results ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-dash-cream">
              {failures.length === 0
                ? `Done — ${results.length} updates applied.`
                : `${results.length - failures.length} applied, ${failures.length} failed.`}
            </p>
            {failures.length > 0 && (
              <ul className="space-y-1 text-xs text-dash-danger">
                {failures.map((failure, index) => (
                  <li key={index}>
                    {nameOf(failure.targetId)} · {APPLY_AREAS.find((a) => a.id === failure.area)?.label}: {failure.error}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-dash-tertiary">
              Each store stays independently editable — this was a copy, not a link.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] rounded-xl bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="label-mono !text-[10px]">Copy from</span>
              <select
                value={sourceId}
                onChange={(event) => {
                  setSourceId(event.target.value)
                  setTargetIds(new Set())
                }}
                className="mt-1 w-full rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none"
              >
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name || 'Untitled'}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="label-mono !text-[10px]">Copy to</span>
              {groups.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {groups.map((group) => (
                    <Pill key={group.id} isActive={false} onClick={() => selectGroup(group)}>
                      Group: {group.name}
                    </Pill>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {targets.map((restaurant) => (
                  <Pill
                    key={restaurant.id}
                    isActive={targetIds.has(restaurant.id)}
                    onClick={() => toggleSet(targetIds, restaurant.id, setTargetIds)}
                  >
                    {restaurant.name || 'Untitled'}
                  </Pill>
                ))}
                {targets.length === 0 && (
                  <p className="text-xs text-dash-tertiary">No other stores to copy to.</p>
                )}
              </div>
            </div>

            <div>
              <span className="label-mono !text-[10px]">Setting areas</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {APPLY_AREAS.map((area) => (
                  <Pill
                    key={area.id}
                    isActive={areaIds.has(area.id)}
                    onClick={() => toggleSet(areaIds, area.id, setAreaIds)}
                  >
                    {area.label}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-dash-tertiary">
                {areaIds.size} area{areaIds.size === 1 ? '' : 's'} → {targetIds.size} store{targetIds.size === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                disabled={running || targetIds.size === 0 || areaIds.size === 0}
                onClick={() => void run()}
                className="min-h-[38px] rounded-xl bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text transition hover:opacity-90 disabled:opacity-50"
              >
                {running ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
