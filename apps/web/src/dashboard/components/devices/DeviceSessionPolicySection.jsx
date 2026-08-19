import { useEffect, useMemo, useState } from 'react'
import { Clock, RotateCcw, Save } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../shared/Card'
import {
  deviceTypeLabel,
  saveDeviceSessionPolicyOverride,
  saveDeviceTypePolicy,
} from '../../data/devices'

const PERSONAL_FALLBACK = {
  idle_lock_seconds: 600,
  manager_idle_lock_seconds: 60,
  idle_lock_seconds_open_check: 300,
  absolute_ttl_seconds: 32400,
  lock_after_check_save: false,
  print_completion_action_override: null,
}
const SHARED_RE = /terminal|station|shared|desktop|kiosk|fixed|^pos$/

export function fallbackSessionPolicy(deviceType) {
  return SHARED_RE.test(String(deviceType || '').toLowerCase())
    ? {
        idle_lock_seconds: 45,
        manager_idle_lock_seconds: 15,
        idle_lock_seconds_open_check: 300,
        absolute_ttl_seconds: 32400,
        lock_after_check_save: true,
        print_completion_action_override: null,
      }
    : PERSONAL_FALLBACK
}

const inputCls =
  'min-h-[38px] w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2.5 text-xs font-medium text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-shell-accent/60 disabled:opacity-50'
const buttonCls =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-dash-border px-3 text-xs font-semibold transition hover:border-shell-accent/50 hover:text-dash-cream disabled:cursor-not-allowed disabled:opacity-50'

const secondsLabel = (seconds) => {
  if (Number(seconds) === 0) return 'never'
  if (Number(seconds) >= 60 && Number(seconds) % 60 === 0) return `${Number(seconds) / 60} min`
  return `${Number(seconds)} sec`
}

const toTypeDraft = (policy) => ({
  idle: String(policy.idle_lock_seconds),
  managerIdle: String(policy.manager_idle_lock_seconds),
  operationalIdleMinutes: String(Math.round(policy.idle_lock_seconds_open_check / 60)),
  ttlMinutes: String(Math.round(policy.absolute_ttl_seconds / 60)),
  leave: policy.lock_after_check_save ? 'lock' : 'stay',
  printCompletion: policy.print_completion_action_override || 'employee_default',
})

const toOverrideDraft = (device) => ({
  idle: device.idle_lock_seconds == null ? '' : String(device.idle_lock_seconds),
  managerIdle: device.manager_idle_lock_seconds == null ? '' : String(device.manager_idle_lock_seconds),
  operationalIdleMinutes: device.idle_lock_seconds_open_check == null ? '' : String(Math.round(device.idle_lock_seconds_open_check / 60)),
  ttlMinutes: device.absolute_ttl_seconds == null ? '' : String(Math.round(device.absolute_ttl_seconds / 60)),
  leave: device.lock_after_check_save == null ? 'inherit' : device.lock_after_check_save ? 'lock' : 'stay',
  printCompletion: device.print_completion_action_override || 'inherit',
})

const parseNumber = (value, minimum) => Math.max(minimum, Math.round(Number(value) || 0))
const nullableNumber = (value, minimum, multiplier = 1) => {
  const raw = String(value).trim()
  return raw === '' ? null : parseNumber(raw, minimum) * multiplier
}

function Field({ label, hint, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="label-mono !text-[9px]">{label}</span>
      {children}
      <span className="min-h-4 text-[10px] text-dash-tertiary">{hint}</span>
    </label>
  )
}

function PolicyFields({ draft, setDraft, inherited = null, busy }) {
  const effective = inherited
    ? {
        idle_lock_seconds: draft.idle === '' ? inherited.idle_lock_seconds : Number(draft.idle),
        manager_idle_lock_seconds: draft.managerIdle === '' ? inherited.manager_idle_lock_seconds : Number(draft.managerIdle),
        idle_lock_seconds_open_check: draft.operationalIdleMinutes === '' ? inherited.idle_lock_seconds_open_check : Number(draft.operationalIdleMinutes) * 60,
        absolute_ttl_seconds: draft.ttlMinutes === '' ? inherited.absolute_ttl_seconds : Number(draft.ttlMinutes) * 60,
        lock_after_check_save: draft.leave === 'inherit' ? inherited.lock_after_check_save : draft.leave === 'lock',
        print_completion_action_override: draft.printCompletion === 'inherit'
          ? inherited.print_completion_action_override
          : draft.printCompletion === 'employee_default' ? null : draft.printCompletion,
      }
    : null
  const source = (overridden) => overridden ? 'individual override' : 'inherited from device type'

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Field
        label="Server idle"
        hint={inherited ? `Effective ${secondsLabel(effective.idle_lock_seconds)} · ${source(draft.idle !== '')}` : 'seconds · 0 = never'}
      >
        <input
          type="number"
          min="0"
          value={draft.idle}
          placeholder={inherited ? String(inherited.idle_lock_seconds) : undefined}
          disabled={busy}
          className={inputCls}
          onChange={(event) => setDraft((current) => ({ ...current, idle: event.target.value }))}
        />
      </Field>
      <Field
        label="Manager idle"
        hint={inherited ? `Effective ${secondsLabel(effective.manager_idle_lock_seconds)} · ${source(draft.managerIdle !== '')}` : 'seconds · must be at least 1'}
      >
        <input
          type="number"
          min="1"
          value={draft.managerIdle}
          placeholder={inherited ? String(inherited.manager_idle_lock_seconds) : undefined}
          disabled={busy}
          className={inputCls}
          onChange={(event) => setDraft((current) => ({ ...current, managerIdle: event.target.value }))}
        />
      </Field>
      <Field
        label="Order & payment protection"
        hint={inherited ? `Effective ${secondsLabel(effective.idle_lock_seconds_open_check)} · ${source(draft.operationalIdleMinutes !== '')}` : 'minutes · minimum 5 · applies to every role'}
      >
        <input
          type="number"
          min="5"
          value={draft.operationalIdleMinutes}
          placeholder={inherited ? String(Math.round(inherited.idle_lock_seconds_open_check / 60)) : undefined}
          disabled={busy}
          className={inputCls}
          onChange={(event) => setDraft((current) => ({ ...current, operationalIdleMinutes: event.target.value }))}
        />
      </Field>
      <Field
        label="Absolute session limit"
        hint={inherited ? `Effective ${secondsLabel(effective.absolute_ttl_seconds)} · ${source(draft.ttlMinutes !== '')}` : 'minutes · applies even while active'}
      >
        <input
          type="number"
          min="1"
          value={draft.ttlMinutes}
          placeholder={inherited ? String(Math.round(inherited.absolute_ttl_seconds / 60)) : undefined}
          disabled={busy}
          className={inputCls}
          onChange={(event) => setDraft((current) => ({ ...current, ttlMinutes: event.target.value }))}
        />
      </Field>
      <Field
        label="After leaving a check"
        hint={inherited ? `Effective ${effective.lock_after_check_save ? 'lock' : 'stay signed in'} · ${source(draft.leave !== 'inherit')}` : 'Send & Save and Save & Leave'}
      >
        <select
          value={draft.leave}
          disabled={busy}
          className={inputCls}
          onChange={(event) => setDraft((current) => ({ ...current, leave: event.target.value }))}
        >
          {inherited ? <option value="inherit">Inherit from device type</option> : null}
          <option value="lock">Return to PIN pad</option>
          <option value="stay">Stay signed in</option>
        </select>
      </Field>
      <Field
        label="After Print"
        hint={inherited
          ? `${effective.print_completion_action_override ? 'Forced for all employees' : 'Employee/shared default'} · ${source(draft.printCompletion !== 'inherit')}`
          : 'Optional manager override for all employees'}
      >
        <select
          value={draft.printCompletion}
          disabled={busy}
          className={inputCls}
          onChange={(event) => setDraft((current) => ({ ...current, printCompletion: event.target.value }))}
        >
          {inherited ? <option value="inherit">Inherit from device type</option> : null}
          {!inherited ? <option value="employee_default">Employee / terminal default</option> : null}
          <option value="return_to_pin">Force Print &amp; Leave</option>
          <option value="stay_on_check">Force Print &amp; Stay</option>
        </select>
      </Field>
    </div>
  )
}

function SaveBar({ reason, setReason, busy, onSave, onReset, onCancel, saveLabel = 'Save settings' }) {
  const disabled = busy || !reason.trim()
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-dash-border pt-3 sm:flex-row sm:items-end">
      <Field label="Reason" hint="Required for the device configuration audit trail">
        <input
          value={reason}
          maxLength={300}
          disabled={busy}
          placeholder="Why is this policy changing?"
          className={`${inputCls} sm:min-w-[280px]`}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2 sm:pb-4">
        <button type="button" className={buttonCls} disabled={busy} onClick={onCancel}>Cancel</button>
        {onReset ? (
          <button type="button" className={buttonCls} disabled={disabled} onClick={onReset}>
            <RotateCcw size={13} aria-hidden="true" /> Reset to device-type default
          </button>
        ) : null}
        <button type="button" className={`${buttonCls} bg-shell-accent/15 text-dash-cream`} disabled={disabled} onClick={onSave}>
          <Save size={13} aria-hidden="true" /> {saveLabel}
        </button>
      </div>
    </div>
  )
}

function TypePolicyRow({ deviceType, policy, onSave, busy }) {
  const effective = policy || fallbackSessionPolicy(deviceType)
  const [draft, setDraft] = useState(() => toTypeDraft(effective))
  const [reason, setReason] = useState('')

  useEffect(() => setDraft(toTypeDraft(effective)), [
    effective.idle_lock_seconds,
    effective.manager_idle_lock_seconds,
    effective.idle_lock_seconds_open_check,
    effective.absolute_ttl_seconds,
    effective.lock_after_check_save,
    effective.print_completion_action_override,
  ])

  const save = () => {
    onSave({
      idle_lock_seconds: parseNumber(draft.idle, 0),
      manager_idle_lock_seconds: parseNumber(draft.managerIdle, 1),
      idle_lock_seconds_open_check: parseNumber(draft.operationalIdleMinutes, 5) * 60,
      absolute_ttl_seconds: parseNumber(draft.ttlMinutes, 1) * 60,
      lock_after_check_save: draft.leave === 'lock',
      print_completion_action_override: draft.printCompletion === 'employee_default' ? null : draft.printCompletion,
    }, reason.trim())
    setReason('')
  }

  const discard = () => {
    setDraft(toTypeDraft(effective))
    setReason('')
  }

  return (
    <div className="rounded-xl border border-dash-border bg-[var(--glass-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-dash-cream">{deviceTypeLabel(deviceType)}</span>
        <span className="label-mono !text-[9px] text-dash-tertiary">
          {policy ? 'configured device-type default' : 'built-in safe default'}
        </span>
      </div>
      <PolicyFields draft={draft} setDraft={setDraft} busy={busy} />
      <SaveBar reason={reason} setReason={setReason} busy={busy} onSave={save} onCancel={discard} />
    </div>
  )
}

function DeviceOverrideRow({ device, policyByType, onSave, busy }) {
  const inherited = policyByType[device.device_type] || fallbackSessionPolicy(device.device_type)
  const [draft, setDraft] = useState(() => toOverrideDraft(device))
  const [reason, setReason] = useState('')

  useEffect(() => setDraft(toOverrideDraft(device)), [
    device.idle_lock_seconds,
    device.manager_idle_lock_seconds,
    device.idle_lock_seconds_open_check,
    device.absolute_ttl_seconds,
    device.lock_after_check_save,
    device.print_completion_action_override,
  ])

  const policyFromDraft = () => ({
    idle_lock_seconds: nullableNumber(draft.idle, 0),
    manager_idle_lock_seconds: nullableNumber(draft.managerIdle, 1),
    idle_lock_seconds_open_check: nullableNumber(draft.operationalIdleMinutes, 5, 60),
    absolute_ttl_seconds: nullableNumber(draft.ttlMinutes, 1, 60),
    lock_after_check_save: draft.leave === 'inherit' ? null : draft.leave === 'lock',
    print_completion_action_override: ['return_to_pin', 'stay_on_check'].includes(draft.printCompletion)
      ? draft.printCompletion
      : null,
  })
  const resetPolicy = {
    idle_lock_seconds: null,
    manager_idle_lock_seconds: null,
    idle_lock_seconds_open_check: null,
    absolute_ttl_seconds: null,
    lock_after_check_save: null,
    print_completion_action_override: null,
  }

  return (
    <div className="rounded-xl border border-dash-border bg-[var(--glass-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-dash-cream">{device.name || 'Unnamed device'}</span>
        <span className="text-xs text-dash-tertiary">{deviceTypeLabel(device.device_type)}</span>
        <span className="label-mono !text-[9px] text-dash-tertiary">{device.status}</span>
      </div>
      <PolicyFields draft={draft} setDraft={setDraft} inherited={inherited} busy={busy} />
      <SaveBar
        reason={reason}
        setReason={setReason}
        busy={busy}
        onCancel={() => {
          setDraft(toOverrideDraft(device))
          setReason('')
        }}
        onSave={() => {
          onSave(policyFromDraft(), reason.trim())
          setReason('')
        }}
        onReset={() => {
          onSave(resetPolicy, reason.trim())
          setReason('')
        }}
        saveLabel="Save device override"
      />
    </div>
  )
}

export default function DeviceSessionPolicySection({ restaurantId, config, mutate, busy }) {
  const devices = config?.devices || []
  const typePolicies = config?.typePolicies || []
  const policyByType = useMemo(
    () => Object.fromEntries(typePolicies.map((policy) => [policy.device_type, policy])),
    [typePolicies],
  )
  const deviceTypes = useMemo(() => {
    const types = new Set(typePolicies.map((policy) => policy.device_type))
    for (const device of devices) if (device.device_type) types.add(device.device_type)
    return Array.from(types).sort()
  }, [typePolicies, devices])

  if (!config) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock size={17} strokeWidth={1.75} className="text-shell-accent" aria-hidden="true" />
          <h2 className="text-base font-semibold text-dash-cream">Session, auto-lock &amp; Print</h2>
        </div>
        <p className="mt-1 text-xs text-dash-tertiary">
          Device-type defaults are only starting points. Override any named terminal or handheld below.
          Changes reach the POS at its next PIN entry or when it returns to the foreground.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="label-mono mb-2">Defaults by device type</h3>
          <div className="space-y-2">
            {deviceTypes.map((deviceType) => (
              <TypePolicyRow
                key={deviceType}
                deviceType={deviceType}
                policy={policyByType[deviceType]}
                busy={busy}
                onSave={(policy, reason) => mutate(() => saveDeviceTypePolicy(restaurantId, deviceType, policy, reason))}
              />
            ))}
            {deviceTypes.length === 0 ? <p className="text-xs text-dash-tertiary">No devices paired yet.</p> : null}
          </div>
        </div>

        {devices.length > 0 ? (
          <div>
            <h3 className="label-mono mb-2">Individual device overrides</h3>
            <div className="space-y-2">
              {devices.map((device) => (
                <DeviceOverrideRow
                  key={device.id}
                  device={device}
                  policyByType={policyByType}
                  busy={busy}
                  onSave={(policy, reason) => mutate(() => saveDeviceSessionPolicyOverride(restaurantId, device.id, policy, reason))}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
