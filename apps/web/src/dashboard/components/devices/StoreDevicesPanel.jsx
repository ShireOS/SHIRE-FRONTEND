import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Layers, Monitor, Plus, Printer, RefreshCw, Send, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../shared/Card'
import { Button } from '../shared/Button'
import { Badge } from '../shared/Badge'
import { Modal } from '../shared/Modal'
import DeviceSessionPolicySection from './DeviceSessionPolicySection'
import {
  CONNECTION_TYPES,
  DEVICE_PRINTER_ROLES,
  DEVICE_TYPE_LABELS,
  PAIRING_CODE_TTL_MINUTES,
  TARGET_TYPES,
  createPairingCode,
  createPrintGroup,
  createPrinterTarget,
  deviceTypeLabel,
  fetchActivePairingCodes,
  fetchLegacyPrinterConfig,
  fetchStoreDeviceConfig,
  fetchTestPrint,
  isDeviceOnline,
  requestTestPrint,
  revokePairingCode,
  setCategoryPrintGroup,
  setDevicePrinter,
  setGroupPrinter,
  updateDevice,
  updatePrinterTarget,
} from '../../data/devices'

const lastSeenLabel = (device) => {
  if (!device.last_seen_at) return 'Never checked in'
  const minutes = Math.floor((Date.now() - new Date(device.last_seen_at).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function SectionTitle({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={17} strokeWidth={1.75} className="text-shell-accent" aria-hidden="true" />
      <h2 className="text-base font-semibold text-dash-cream">{title}</h2>
      {count !== undefined && <span className="label-mono">{count}</span>}
    </div>
  )
}

function SelectField({ label, value, onChange, children, disabled }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="label-mono !text-[9px]">{label}</span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="min-h-[34px] w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 text-xs font-medium text-dash-cream outline-none transition focus:border-shell-accent/60 disabled:opacity-50"
      >
        {children}
      </select>
    </label>
  )
}

function TextField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="label-mono !text-[9px]">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="min-h-[34px] w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2.5 text-xs font-medium text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-shell-accent/60"
      />
    </label>
  )
}

function DeviceRow({ device, printerTargets, onRename, onPrinterChange, onToggleStatus, busy }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(device.name || '')
  const online = isDeviceOnline(device)
  const revoked = device.status === 'revoked'
  const assignments = useMemo(() => {
    const map = {}
    for (const row of device.printers || []) map[row.role] = row.target_id
    return map
  }, [device.printers])

  const commitName = () => {
    setEditing(false)
    const next = draftName.trim()
    if (next && next !== device.name) onRename(device, next)
    else setDraftName(device.name || '')
  }

  return (
    <div className={`rounded-xl border border-dash-border bg-[var(--glass-bg)] p-4 ${revoked ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Monitor size={16} strokeWidth={1.75} className="shrink-0 text-dash-tertiary" aria-hidden="true" />
        {editing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setDraftName(device.name || ''); setEditing(false) }
            }}
            className="min-h-[32px] rounded-lg border border-shell-accent/60 bg-transparent px-2 text-sm font-semibold text-dash-cream outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Rename device"
            className="truncate text-sm font-semibold text-dash-cream transition hover:text-shell-accent"
          >
            {device.name || 'Unnamed device'}
          </button>
        )}
        <span className="text-xs text-dash-tertiary">{deviceTypeLabel(device.device_type)}</span>
        {revoked ? (
          <Badge variant="danger">Deactivated</Badge>
        ) : (
          <Badge variant={online ? 'success' : 'neutral'} dot>
            {online ? 'Online' : `Offline · ${lastSeenLabel(device)}`}
          </Badge>
        )}
        <div className="ml-auto">
          <Button
            variant={revoked ? 'success' : 'ghost'}
            size="sm"
            disabled={busy}
            onClick={() => onToggleStatus(device)}
          >
            {revoked ? 'Reactivate' : 'Deactivate'}
          </Button>
        </div>
      </div>
      {!revoked && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {DEVICE_PRINTER_ROLES.map((role) => (
            <SelectField
              key={role.id}
              label={role.label}
              value={assignments[role.id] || ''}
              disabled={busy}
              onChange={(e) => onPrinterChange(device, role.id, e.target.value || null)}
            >
              <option value="">— none —</option>
              {printerTargets.map((target) => (
                <option key={target.id} value={target.id}>{target.name}</option>
              ))}
            </SelectField>
          ))}
        </div>
      )}
    </div>
  )
}

function PairingModal({ restaurantId, isOpen, onClose }) {
  const [deviceName, setDeviceName] = useState('')
  const [deviceType, setDeviceType] = useState('android_tablet')
  const [codes, setCodes] = useState([])
  const [freshCode, setFreshCode] = useState(null)
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const loadCodes = useCallback(() => {
    if (!restaurantId) return
    fetchActivePairingCodes(restaurantId).then(setCodes).catch(() => setCodes([]))
  }, [restaurantId])

  useEffect(() => {
    if (isOpen) {
      setFreshCode(null)
      setError(null)
      loadCodes()
    }
  }, [isOpen, loadCodes])

  const handleGenerate = async () => {
    setWorking(true)
    setError(null)
    try {
      const row = await createPairingCode(restaurantId, { deviceName: deviceName.trim(), deviceType })
      setFreshCode(row)
      setDeviceName('')
      loadCodes()
    } catch (err) {
      setError(err.message || 'Could not create a pairing code')
    } finally {
      setWorking(false)
    }
  }

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be unavailable; the code is on screen regardless.
    }
  }

  const handleRevoke = async (codeId) => {
    await revokePairingCode(codeId)
    if (freshCode?.id === codeId) setFreshCode(null)
    loadCodes()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a device" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-dash-secondary">
          Generate a pairing code, then enter it on the POS app on the new device.
          Codes expire after {PAIRING_CODE_TTL_MINUTES} minutes.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="Device name (optional)"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Bar terminal 2"
          />
          <SelectField label="Device type" value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
            {Object.entries(DEVICE_TYPE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </SelectField>
        </div>
        <Button onClick={handleGenerate} disabled={working} icon={<Plus size={15} aria-hidden="true" />}>
          {working ? 'Generating…' : 'Generate pairing code'}
        </Button>
        {error && <p className="text-sm text-dash-danger">{error}</p>}
        {freshCode && (
          <div className="rounded-xl border border-shell-accent/40 bg-shell-accent/[0.08] p-4 text-center">
            <p className="label-mono">Pairing code</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-shell-accent">{freshCode.code}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => handleCopy(freshCode.code)}
              icon={copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            >
              {copied ? 'Copied' : 'Copy code'}
            </Button>
          </div>
        )}
        {codes.length > 0 && (
          <div className="space-y-2">
            <p className="label-mono">Active codes</p>
            {codes.map((code) => (
              <div key={code.id} className="flex items-center gap-3 rounded-lg border border-dash-border px-3 py-2">
                <span className="font-mono text-sm font-semibold text-dash-cream">{code.code}</span>
                <span className="truncate text-xs text-dash-tertiary">
                  {code.device_name || 'Unnamed'} · expires {new Date(code.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                <button
                  type="button"
                  onClick={() => handleRevoke(code.id)}
                  title="Revoke code"
                  className="ml-auto text-dash-tertiary transition hover:text-dash-danger"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// Per-store devices & printing surface, shared by the enterprise Devices page
// (drill-in) and the store-zone Devices tab. Three linked layers on one page:
// menu categories → print groups → printers, plus per-device printer roles.
export default function StoreDevicesPanel({ restaurantId }) {
  const [config, setConfig] = useState(null)
  const [legacyConfig, setLegacyConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pairingOpen, setPairingOpen] = useState(false)
  const [printerDraft, setPrinterDraft] = useState({ name: '', target_type: 'printer', connection_type: 'network', host: '', port: '' })
  const [groupDraft, setGroupDraft] = useState('')
  const [testStates, setTestStates] = useState({})

  const load = useCallback(async () => {
    if (!restaurantId) return
    try {
      const [cfg, legacy] = await Promise.all([
        fetchStoreDeviceConfig(restaurantId),
        fetchLegacyPrinterConfig(restaurantId),
      ])
      setConfig(cfg)
      setLegacyConfig(legacy)
      setError(null)
    } catch (err) {
      setError(err.message || 'Could not load device configuration')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    setLoading(true)
    setConfig(null)
    load()
  }, [load])

  const mutate = useCallback(async (action) => {
    setBusy(true)
    try {
      await action()
      await load()
    } catch (err) {
      setError(err.message || 'Change failed')
    } finally {
      setBusy(false)
    }
  }, [load])

  const printerTargets = useMemo(
    () => (config?.targets || []).filter((t) => t.is_active),
    [config?.targets]
  )

  // Test tickets print via an online POS device's LAN bridge, so the request
  // is queued in the DB and polled until a device picks it up (or we give up).
  const runTestPrint = useCallback(async (target) => {
    const setPhase = (phase, message) =>
      setTestStates((prev) => ({ ...prev, [target.id]: { phase, message } }))
    setPhase('queued')
    try {
      const job = await requestTestPrint(restaurantId, target.id)
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        const row = await fetchTestPrint(job.id)
        if (row.status === 'printed') {
          setPhase('printed', 'Test ticket printed')
          return
        }
        if (row.status === 'failed') {
          setPhase('failed', row.error || 'Print failed')
          return
        }
      }
      setPhase('failed', 'No POS device picked this up — a paired terminal must be online at the store')
    } catch (err) {
      setPhase('failed', err.message || 'Could not queue the test ticket')
    }
  }, [restaurantId])

  // Legacy POS-app printers (bare IPs on the store config) that aren't
  // already registered as routing targets — offered as one-click imports.
  const legacyPrinters = useMemo(() => {
    if (!legacyConfig) return []
    const knownHosts = new Set(
      (config?.targets || [])
        .map((t) => String(t.config?.host || '').trim())
        .filter(Boolean)
    )
    return [
      { key: 'receipt', name: 'Receipt printer', host: legacyConfig.receipt_printer_ip },
      { key: 'kitchen', name: 'Kitchen printer', host: legacyConfig.kitchen_printer_ip },
    ]
      .map((p) => ({ ...p, host: String(p.host || '').trim() }))
      .filter((p) => p.host && !knownHosts.has(p.host))
  }, [legacyConfig, config?.targets])

  if (loading) {
    return <p className="text-sm text-dash-secondary">Loading devices…</p>
  }

  if (!config) {
    return <p className="text-sm text-dash-danger">{error || 'Could not load device configuration'}</p>
  }

  const { devices, targets, stations, categories } = config

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-dash-danger/40 bg-dash-danger/10 px-4 py-3 text-sm text-dash-danger">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={Monitor} title="Devices" count={devices.length} />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} icon={<RefreshCw size={14} aria-hidden="true" />}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => setPairingOpen(true)} icon={<Plus size={14} aria-hidden="true" />}>
              Add device
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 && (
            <p className="text-sm text-dash-secondary">
              No devices paired yet. Add one to generate a pairing code for the POS app.
            </p>
          )}
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              printerTargets={printerTargets}
              busy={busy}
              onRename={(d, name) => mutate(() => updateDevice(d.id, { name }))}
              onPrinterChange={(d, role, targetId) => mutate(() => setDevicePrinter(d.id, role, targetId))}
              onToggleStatus={(d) => mutate(() => updateDevice(d.id, { status: d.status === 'revoked' ? 'active' : 'revoked' }))}
            />
          ))}
        </CardContent>
      </Card>

      <DeviceSessionPolicySection restaurantId={restaurantId} config={config} mutate={mutate} busy={busy} />

      <Card>
        <CardHeader>
          <SectionTitle icon={Printer} title="Printers & screens" count={targets.length} />
        </CardHeader>
        <CardContent className="space-y-3">
          {targets.map((target) => {
            const test = testStates[target.id]
            const canTest = target.is_active && target.target_type === 'printer' && Boolean(target.config?.host)
            return (
              <div key={target.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-4 py-3">
                <span className="text-sm font-semibold text-dash-cream">{target.name}</span>
                <Badge variant="info">{TARGET_TYPES.find((t) => t.id === target.target_type)?.label || target.target_type}</Badge>
                <span className="text-xs text-dash-tertiary">
                  {CONNECTION_TYPES.find((c) => c.id === target.connection_type)?.label || target.connection_type}
                  {target.config?.host ? ` · ${target.config.host}${target.config.port ? `:${target.config.port}` : ''}` : ''}
                </span>
                {test && (
                  <span className={`text-xs ${test.phase === 'failed' ? 'text-dash-danger' : test.phase === 'printed' ? 'text-dash-success' : 'text-dash-secondary'}`}>
                    {test.phase === 'queued' ? 'Sending test ticket…' : test.message}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {canTest && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={test?.phase === 'queued'}
                      onClick={() => runTestPrint(target)}
                      icon={<Send size={13} aria-hidden="true" />}
                    >
                      Test print
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => mutate(() => updatePrinterTarget(target.id, { is_active: !target.is_active }))}
                  >
                    {target.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            )
          })}
          {legacyPrinters.length > 0 && (
            <div className="rounded-xl border border-dashed border-dash-border p-4">
              <p className="text-xs text-dash-secondary">
                Found on the POS app&apos;s printer setup but not registered here yet — import to manage and route them from the portal.
              </p>
              <div className="mt-2 space-y-2">
                {legacyPrinters.map((printer) => (
                  <div key={printer.key} className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-dash-cream">{printer.name}</span>
                    <span className="text-xs text-dash-tertiary">Network (IP) · {printer.host}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      disabled={busy}
                      icon={<Plus size={13} aria-hidden="true" />}
                      onClick={() => mutate(() => createPrinterTarget(restaurantId, {
                        name: printer.name,
                        target_type: 'printer',
                        connection_type: 'network',
                        host: printer.host,
                        port: 9100,
                      }))}
                    >
                      Import
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 items-end gap-2 rounded-xl border border-dashed border-dash-border p-4 md:grid-cols-6">
            <TextField
              label="Name"
              value={printerDraft.name}
              onChange={(e) => setPrinterDraft({ ...printerDraft, name: e.target.value })}
              placeholder="Kitchen printer"
            />
            <SelectField
              label="Type"
              value={printerDraft.target_type}
              onChange={(e) => setPrinterDraft({ ...printerDraft, target_type: e.target.value })}
            >
              {TARGET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </SelectField>
            <SelectField
              label="Connection"
              value={printerDraft.connection_type}
              onChange={(e) => setPrinterDraft({ ...printerDraft, connection_type: e.target.value })}
            >
              {CONNECTION_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </SelectField>
            <TextField
              label="Host / IP"
              value={printerDraft.host}
              onChange={(e) => setPrinterDraft({ ...printerDraft, host: e.target.value })}
              placeholder="192.168.1.50"
            />
            <TextField
              label="Port"
              value={printerDraft.port}
              onChange={(e) => setPrinterDraft({ ...printerDraft, port: e.target.value })}
              placeholder="9100"
            />
            <Button
              size="sm"
              disabled={busy || !printerDraft.name.trim()}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={() => mutate(async () => {
                await createPrinterTarget(restaurantId, { ...printerDraft, name: printerDraft.name.trim() })
                setPrinterDraft({ name: '', target_type: 'printer', connection_type: 'network', host: '', port: '' })
              })}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle icon={Layers} title="Print groups" count={stations.length} />
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-dash-secondary">
            Menu categories route to a print group; each group prints on the printers it subscribes to.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {stations.map((station) => {
              const subscribed = new Set((station.subscriptions || []).map((s) => s.target_id))
              return (
                <div key={station.id} className="rounded-xl border border-dash-border bg-[var(--glass-bg)] p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-dash-cream">{station.name}</span>
                    {!station.is_active && <Badge variant="neutral">Inactive</Badge>}
                    {station.kds_enabled && <Badge variant="gold">KDS</Badge>}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {targets.length === 0 && (
                      <p className="text-xs text-dash-tertiary">Add a printer above to subscribe this group.</p>
                    )}
                    {targets.map((target) => (
                      <label key={target.id} className="flex cursor-pointer items-center gap-2 text-xs text-dash-secondary transition hover:text-dash-cream">
                        <input
                          type="checkbox"
                          checked={subscribed.has(target.id)}
                          disabled={busy}
                          onChange={(e) => mutate(() => setGroupPrinter(station.id, target.id, e.target.checked))}
                          className="h-3.5 w-3.5 accent-[var(--shell-accent)]"
                        />
                        <span>{target.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="flex items-end gap-2 rounded-xl border border-dashed border-dash-border p-4">
              <TextField
                label="New print group"
                value={groupDraft}
                onChange={(e) => setGroupDraft(e.target.value)}
                placeholder="Hot Kitchen"
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={busy || !groupDraft.trim()}
                icon={<Plus size={14} aria-hidden="true" />}
                onClick={() => mutate(async () => {
                  await createPrintGroup(restaurantId, groupDraft.trim())
                  setGroupDraft('')
                })}
              >
                Add
              </Button>
            </div>
          </div>

          <div>
            <p className="label-mono pb-2">Menu categories → print group</p>
            {categories.length === 0 ? (
              <p className="text-sm text-dash-secondary">No menu categories yet — add them in Setup → Menu.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2 rounded-lg border border-dash-border px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-dash-cream">{category.name}</span>
                    <select
                      value={category.routing_station_id || ''}
                      disabled={busy}
                      onChange={(e) => mutate(() => setCategoryPrintGroup(category.id, e.target.value || null))}
                      className="min-h-[30px] rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 text-xs text-dash-cream outline-none transition focus:border-shell-accent/60"
                    >
                      <option value="">— unrouted —</option>
                      {stations.map((station) => (
                        <option key={station.id} value={station.id}>{station.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PairingModal
        restaurantId={restaurantId}
        isOpen={pairingOpen}
        onClose={() => { setPairingOpen(false); load() }}
      />
    </div>
  )
}
