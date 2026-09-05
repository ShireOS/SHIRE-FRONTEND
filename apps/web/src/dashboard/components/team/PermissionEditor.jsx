import { useMemo } from 'react'
import { Lock, RotateCcw } from 'lucide-react'
import {
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSION_PRESETS,
  TAB_PERMISSIONS,
  can,
} from '../../../shared/permissions'

// ── Value contract ───────────────────────────────────────────────────────────
// `value` IS the full effective permission map: every key in PERMISSION_KEYS,
// true/false, after role defaults + member overrides are merged (call
// mergePermissions before passing it in). `onChange` always emits the next
// FULL effective map — never a partial diff.
//   • Parents that persist overrides (per-member rows) diff the effective map
//     against roleDefaults before saving: use diffOverrides(effective, roleDefaults).
//   • Parents that persist the map itself (role defaults in
//     pos_role_permissions.back_office_permissions) save the emitted map verbatim.
// Keys locked by `grantCap` (any key not true in the cap) keep their current
// value in every emitted map — presets and "Reset to role" included.

export { diffPermissionOverrides as diffOverrides } from '../../../shared/permissions'

// Mirrors the store sidebar. Tabs missing from TAB_PERMISSIONS (Home) are
// always visible.
const NAV_PREVIEW = [
  { id: 'home', label: 'Home' },
  { id: 'setup', label: 'Setup' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'menu', label: 'Menu' },
  { id: 'feedback', label: 'Complaints' },
  { id: 'devices', label: 'Devices' },
  { id: 'pos-settings', label: 'POS Settings' },
  { id: 'team', label: 'Members' },
  { id: 'tip-pooling', label: 'Workforce & Pay', anyOf: ['team.view', 'payroll.view'] },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'payments', label: 'Payments' },
]

const chipCls = (active) =>
  [
    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
    active
      ? 'border-shell-accent/60 bg-shell-accent/15 text-dash-cream'
      : 'border-dash-border text-dash-tertiary hover:border-shell-accent/50 hover:text-dash-secondary',
  ].join(' ')

function Switch({ checked, disabled, locked, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      title={locked ? "You can't grant permissions you don't hold" : undefined}
      onClick={onToggle}
      className={[
        'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition',
        checked ? 'border-shell-accent/60 bg-shell-accent/25' : 'border-dash-border bg-[var(--glass-bg)]',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-shell-accent/50',
      ].join(' ')}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full transition-transform ${
          checked ? 'translate-x-[18px] bg-shell-accent' : 'translate-x-[3px] bg-dash-tertiary'
        }`}
      />
    </button>
  )
}

function NavPreview({ effective }) {
  return (
    <div className="h-fit rounded-xl border border-dash-border bg-[var(--glass-bg)] p-3">
      <p className="label-mono !text-[9px]">They will see</p>
      <ul className="mt-2 space-y-1">
        {NAV_PREVIEW.map((item) => {
          const required = TAB_PERMISSIONS[item.id]
          const visible = item.anyOf
            ? item.anyOf.some((permission) => can(effective, permission))
            : !required || can(effective, required)
          return (
            <li
              key={item.id}
              className={`flex items-center gap-2 text-xs ${
                visible ? 'text-dash-cream' : 'text-dash-tertiary line-through opacity-60'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${visible ? 'bg-dash-success' : 'bg-dash-border'}`}
                aria-hidden="true"
              />
              {item.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function PermissionEditor({
  value,
  roleDefaults = null,
  onChange,
  grantCap = null,
  showPreview = false,
  disabled = false,
}) {
  const effective = useMemo(() => {
    const map = {}
    for (const key of PERMISSION_KEYS) map[key] = can(value, key)
    return map
  }, [value])

  const hasRoleDefaults = roleDefaults != null
  const isLocked = (key) => Boolean(grantCap) && !can(grantCap, key)

  const emit = (next) => {
    if (!disabled && typeof onChange === 'function') onChange(next)
  }

  const activePresetId = useMemo(() => {
    const match = PERMISSION_PRESETS.find((preset) =>
      PERMISSION_KEYS.every((key) => Boolean(preset.permissions[key]) === effective[key])
    )
    return match?.id || null
  }, [effective])

  const applyPreset = (preset) => {
    const next = {}
    for (const key of PERMISSION_KEYS) {
      next[key] = isLocked(key) ? effective[key] : Boolean(preset.permissions[key])
    }
    emit(next)
  }

  const hasOverrides = useMemo(
    () => hasRoleDefaults && PERMISSION_KEYS.some((key) => effective[key] !== can(roleDefaults, key)),
    [hasRoleDefaults, roleDefaults, effective]
  )

  const resetToRole = () => {
    const next = {}
    for (const key of PERMISSION_KEYS) {
      next[key] = isLocked(key) ? effective[key] : can(roleDefaults, key)
    }
    emit(next)
  }

  const editor = (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERMISSION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            aria-pressed={activePresetId === preset.id}
            onClick={() => applyPreset(preset)}
            className={chipCls(activePresetId === preset.id)}
          >
            {preset.label}
          </button>
        ))}
        {!activePresetId && <span className={chipCls(true)}>Custom</span>}
        {hasRoleDefaults && hasOverrides && (
          <button
            type="button"
            disabled={disabled}
            onClick={resetToRole}
            className="ml-auto flex items-center gap-1 text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary disabled:opacity-50"
          >
            <RotateCcw size={12} strokeWidth={1.75} aria-hidden="true" />
            Reset to role
          </button>
        )}
      </div>

      {PERMISSION_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="label-mono !text-[9px]">{group.label}</p>
          <div className="mt-1.5 space-y-1.5">
            {group.keys.map((def) => {
              const locked = isLocked(def.key)
              const differs = hasRoleDefaults && effective[def.key] !== Boolean(roleDefaults?.[def.key])
              return (
                <div
                  key={def.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-dash-cream">{def.label}</span>
                      {hasRoleDefaults &&
                        (differs ? (
                          <span
                            title="Differs from the role default"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-dash-gold"
                          />
                        ) : (
                          <span className="rounded-full border border-dash-border px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-dash-tertiary">
                            inherited
                          </span>
                        ))}
                      {locked && (
                        <span title="You can't grant permissions you don't hold" className="text-dash-tertiary">
                          <Lock size={11} strokeWidth={1.75} aria-label="Locked" />
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-dash-tertiary" title={def.description}>
                      {def.description}
                    </span>
                  </span>
                  <Switch
                    checked={effective[def.key]}
                    disabled={disabled || locked}
                    locked={locked}
                    label={def.label}
                    onToggle={() => emit({ ...effective, [def.key]: !effective[def.key] })}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  if (!showPreview) return editor

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_210px] md:gap-5">
      {editor}
      <NavPreview effective={effective} />
    </div>
  )
}
