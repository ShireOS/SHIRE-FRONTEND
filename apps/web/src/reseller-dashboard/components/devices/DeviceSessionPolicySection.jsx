import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../shared/Card'
import { deviceTypeLabel, updateDevice, upsertDeviceTypePolicy } from '../../data/devices'

// Built-in fallback (mirrors the backend) shown when a type has no configured row.
const FALLBACK = { idle_lock_seconds: 0, absolute_ttl_seconds: 32400, persist_manager_session: true }
const SHARED_RE = /terminal|station|shared|desktop|kiosk|fixed/

function fallbackFor(deviceType) {
  return SHARED_RE.test(String(deviceType || '').toLowerCase())
    ? { idle_lock_seconds: 90, absolute_ttl_seconds: 900, persist_manager_session: false }
    : FALLBACK
}

const secToMin = (s) => (s == null ? '' : String(Math.round(s / 60)))
const minToSec = (m) => Math.max(1, Math.round(Number(m) * 60))

function Field({ label, hint, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="label-mono !text-[9px]">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-dash-tertiary">{hint}</span> : null}
    </label>
  )
}

const inputCls =
  'min-h-[34px] w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2.5 text-xs font-medium text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-shell-accent/60 disabled:opacity-50'

// Editable defaults for one device_type.
function TypePolicyRow({ deviceType, policy, onSave, busy }) {
  const eff = policy || fallbackFor(deviceType)
  return (
    <div className="rounded-xl border border-dash-border bg-[var(--glass-bg)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-dash-cream">{deviceTypeLabel(deviceType)}</span>
        {!policy ? <span className="label-mono !text-[9px] text-dash-tertiary">built-in default</span> : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Idle auto-lock" hint="seconds · 0 = never">
          <input
            type="number"
            min="0"
            defaultValue={String(eff.idle_lock_seconds ?? 0)}
            disabled={busy}
            className={inputCls}
            onBlur={(e) => {
              const next = Math.max(0, Math.round(Number(e.target.value) || 0))
              if (next !== eff.idle_lock_seconds) onSave({ idle_lock_seconds: next })
            }}
          />
        </Field>
        <Field label="Session length" hint="minutes">
          <input
            type="number"
            min="1"
            defaultValue={secToMin(eff.absolute_ttl_seconds)}
            disabled={busy}
            className={inputCls}
            onBlur={(e) => {
              const next = minToSec(e.target.value)
              if (next !== eff.absolute_ttl_seconds) onSave({ absolute_ttl_seconds: next })
            }}
          />
        </Field>
        <Field label="Manager session">
          <select
            value={eff.persist_manager_session ? 'keep' : 'reprompt'}
            disabled={busy}
            className={inputCls}
            onChange={(e) => onSave({ persist_manager_session: e.target.value === 'keep' })}
          >
            <option value="keep">Keep warm all shift</option>
            <option value="reprompt">Re-prompt each action</option>
          </select>
        </Field>
      </div>
    </div>
  )
}

// Per-device override (blank = inherit the device_type default).
function DeviceOverrideRow({ device, policyByType, onSave, busy }) {
  const inherited = policyByType[device.device_type] || fallbackFor(device.device_type)
  const idleHint = `inherits ${inherited.idle_lock_seconds === 0 ? 'never' : `${inherited.idle_lock_seconds}s`}`
  const ttlHint = `inherits ${Math.round(inherited.absolute_ttl_seconds / 60)} min`
  return (
    <div className="rounded-xl border border-dash-border bg-[var(--glass-bg)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-dash-cream">{device.name || 'Unnamed device'}</span>
        <span className="text-xs text-dash-tertiary">{deviceTypeLabel(device.device_type)}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Idle auto-lock" hint={idleHint}>
          <input
            type="number"
            min="0"
            placeholder="inherit"
            defaultValue={device.idle_lock_seconds ?? ''}
            disabled={busy}
            className={inputCls}
            onBlur={(e) => {
              const raw = e.target.value.trim()
              const next = raw === '' ? null : Math.max(0, Math.round(Number(raw) || 0))
              if (next !== (device.idle_lock_seconds ?? null)) onSave({ idle_lock_seconds: next })
            }}
          />
        </Field>
        <Field label="Session length" hint={ttlHint}>
          <input
            type="number"
            min="1"
            placeholder="inherit"
            defaultValue={secToMin(device.absolute_ttl_seconds)}
            disabled={busy}
            className={inputCls}
            onBlur={(e) => {
              const raw = e.target.value.trim()
              const next = raw === '' ? null : minToSec(raw)
              if (next !== (device.absolute_ttl_seconds ?? null)) onSave({ absolute_ttl_seconds: next })
            }}
          />
        </Field>
        <Field label="Manager session">
          <select
            value={device.persist_manager_session == null ? 'inherit' : device.persist_manager_session ? 'keep' : 'reprompt'}
            disabled={busy}
            className={inputCls}
            onChange={(e) => {
              const v = e.target.value
              onSave({ persist_manager_session: v === 'inherit' ? null : v === 'keep' })
            }}
          >
            <option value="inherit">Inherit ({inherited.persist_manager_session ? 'keep warm' : 're-prompt'})</option>
            <option value="keep">Keep warm all shift</option>
            <option value="reprompt">Re-prompt each action</option>
          </select>
        </Field>
      </div>
    </div>
  )
}

export default function DeviceSessionPolicySection({ restaurantId, config, mutate, busy }) {
  const devices = config?.devices || []
  const typePolicies = config?.typePolicies || []

  const policyByType = useMemo(() => {
    const map = {}
    for (const p of typePolicies) map[p.device_type] = p
    return map
  }, [typePolicies])

  // Device types to show defaults for: any configured, plus any in use by a device.
  const deviceTypes = useMemo(() => {
    const set = new Set()
    for (const p of typePolicies) set.add(p.device_type)
    for (const d of devices) if (d.device_type) set.add(d.device_type)
    return Array.from(set).sort()
  }, [typePolicies, devices])

  if (!config) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock size={17} strokeWidth={1.75} className="text-shell-accent" aria-hidden="true" />
          <h2 className="text-base font-semibold text-dash-cream">Session &amp; auto-lock</h2>
        </div>
        <p className="mt-1 text-xs text-dash-tertiary">
          How quickly a device returns to the PIN pad, and whether a manager stays authorized. Shared
          terminals should lock fast; a server&rsquo;s own tablet can stay in all shift.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="label-mono mb-2">Defaults by device type</h3>
          <div className="space-y-2">
            {deviceTypes.map((dt) => (
              <TypePolicyRow
                key={dt}
                deviceType={dt}
                policy={policyByType[dt]}
                busy={busy}
                onSave={(patch) => mutate(() => upsertDeviceTypePolicy(restaurantId, dt, patch))}
              />
            ))}
            {deviceTypes.length === 0 ? (
              <p className="text-xs text-dash-tertiary">No devices paired yet.</p>
            ) : null}
          </div>
        </div>

        {devices.length > 0 ? (
          <div>
            <h3 className="label-mono mb-2">Per-device overrides</h3>
            <div className="space-y-2">
              {devices.map((device) => (
                <DeviceOverrideRow
                  key={device.id}
                  device={device}
                  policyByType={policyByType}
                  busy={busy}
                  onSave={(patch) => mutate(() => updateDevice(device.id, patch))}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
