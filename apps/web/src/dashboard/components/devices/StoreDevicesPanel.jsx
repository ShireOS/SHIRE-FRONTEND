import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, Layers, Monitor, Pencil, Plus, Printer, RefreshCw, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../shared/Card'
import { Button } from '../shared/Button'
import { Badge } from '../shared/Badge'
import { Modal } from '../shared/Modal'
import DeviceSessionPolicySection from './DeviceSessionPolicySection'
import HardwareChainGuide from '../printing/HardwareChainGuide'
import PrinterEndpointEditModal from '../printing/PrinterEndpointEditModal'
import { useAuth } from '../../../auth'
import { useBackOfficeAccess } from '../../../shared/hooks/useBackOfficeAccess'
import {
  CONNECTION_TYPES,
  DEVICE_TYPE_LABELS,
  PAIRING_CODE_TTL_MINUTES,
  TARGET_TYPES,
  createPairingCode,
  createPrintGroup,
  createPrinterTarget,
  deviceTypeLabel,
  fetchActivePairingCodes,
  fetchLegacyPrinterConfig,
  fetchPrinterFailover,
  fetchStoreDeviceConfig,
  fetchTestPrint,
  isDeviceOnline,
  requestTestPrint,
  revokePairingCode,
  savePrinterFailover,
  saveCashDrawerTargetConfig,
  saveDeviceHardwareConfig,
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

function DeviceRow({ device, receiptTargets, printerEndpoints, sections, showAssignments, showHardware, onRename, onSectionChange, onPrinterChange, onHardwareChange, onToggleStatus, busy }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(device.name || '')
  const online = isDeviceOnline(device)
  const revoked = device.status === 'revoked'
  const observed = device.observed_capabilities || {}
  const hardware = device.hardware_config || {}
  const cash = hardware.cash || {}
  const discoveredPrinters = Array.isArray(observed.discovered_printers) ? observed.discovered_printers : []
  const usbEndpoints = (printerEndpoints || []).filter((endpoint) => endpoint.agent_device_id === device.id && endpoint.connection_type === 'usb' && endpoint.is_active)
  const endpointFor = (printer) => usbEndpoints.find((endpoint) => {
    const endpointSerial = String(endpoint.config?.serial_number || '').trim()
    const printerSerial = String(printer.serial_number || '').trim()
    if (endpointSerial && printerSerial) return endpointSerial === printerSerial
    if (endpoint.config?.usb_device_id != null && Number(endpoint.config.usb_device_id) === Number(printer.device_id)) return true
    return Number(endpoint.config?.vendor_id) === Number(printer.vendor_id)
      && Number(endpoint.config?.product_id) === Number(printer.product_id)
      && discoveredPrinters.filter((candidate) => Number(candidate.vendor_id) === Number(printer.vendor_id) && Number(candidate.product_id) === Number(printer.product_id)).length === 1
  })
  const assignments = useMemo(() => {
    const map = {}
    for (const row of device.printers || []) map[row.role] = row.physical_target_id
    return map
  }, [device.printers])
  const acceptsCash = cash.accepts_cash ?? Boolean(assignments.cash_drawer)
  const autoOpenDrawer = cash.auto_open ?? Boolean(assignments.cash_drawer)
  const staleAssignments = (device.printers || []).filter(
    (assignment) => ['receipt', 'cash_drawer'].includes(assignment.role) && !assignment.physical_target_id
  )
  const boundReceiptTarget = receiptTargets.find((target) => target.pos_device_id === device.id)
  const restaurantDefaultReceiptTarget = receiptTargets.find((target) => !target.pos_device_id)
  const receiptSelection = assignments.receipt || boundReceiptTarget?.id || ''

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
        <>
          {showAssignments && <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <SelectField
              label="Section (revenue center)"
              value={device.revenue_center_id || ''}
              disabled={busy}
              onChange={(e) => onSectionChange(device, e.target.value || null)}
            >
              <option value="">Table / unassigned</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </SelectField>
            {[
              { id: 'receipt', label: 'Receipt printer' },
              { id: 'cash_drawer', label: 'Cash drawer connected to' },
            ].map((role) => (
              <SelectField
                key={role.id}
                label={role.label}
                value={role.id === 'receipt' ? receiptSelection : assignments[role.id] || ''}
                disabled={busy}
                onChange={(e) => onPrinterChange(device, role.id, e.target.value || null)}
              >
                <option value="">
                  {role.id === 'receipt' && restaurantDefaultReceiptTarget
                    ? `Restaurant default · ${restaurantDefaultReceiptTarget.name}`
                    : '— none —'}
                </option>
                {receiptTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}{target.usage === 'both' ? ' · receipts + kitchen' : ' · receipts'}
                  </option>
                ))}
              </SelectField>
            ))}
          </div>}
          {showAssignments && receiptTargets.length === 0 && (
            <p className="mt-2 text-xs text-dash-warning">
              No receipt-capable printer is configured. Add one under Printer Setup and mark its usage as Receipts or Both.
            </p>
          )}
          {showAssignments && staleAssignments.length > 0 && (
            <p className="mt-2 text-xs text-dash-warning">
              Legacy assignment {staleAssignments.map((assignment) => assignment.legacy_target_name || assignment.target_id).join(', ')} is not linked to a current receipt printer and is intentionally excluded.
            </p>
          )}
          {showHardware && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-dash-border pt-3 text-xs text-dash-secondary">
            <span>
              Observed: {observed.platform || 'not reported'} · USB {observed.usb_printer_module_available ? 'available' : 'unavailable'}
              {device.capabilities_reported_at ? ` · ${new Date(device.capabilities_reported_at).toLocaleString()}` : ''}
            </span>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hardware.local_agent_enabled !== false} disabled={busy} onChange={(event) => onHardwareChange(device, { ...hardware, local_agent_enabled: event.target.checked })} />
              Local hardware agent
            </label>
            <label className={`flex items-center gap-2 ${!observed.usb_printer_module_available ? 'opacity-50' : ''}`}>
              <input type="checkbox" checked={Boolean(hardware.serve_usb_peripherals)} disabled={busy || !observed.usb_printer_module_available} onChange={(event) => onHardwareChange(device, { ...hardware, serve_usb_peripherals: event.target.checked })} />
              Serve USB peripherals
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={acceptsCash} disabled={busy} onChange={(event) => onHardwareChange(device, { ...hardware, cash: { ...cash, accepts_cash: event.target.checked, auto_open: event.target.checked ? autoOpenDrawer : false } })} />
              Accept cash
            </label>
            <label className={`flex items-center gap-2 ${!acceptsCash || !assignments.cash_drawer ? 'opacity-50' : ''}`}>
              <input type="checkbox" checked={autoOpenDrawer} disabled={busy || !acceptsCash || !assignments.cash_drawer} onChange={(event) => onHardwareChange(device, { ...hardware, cash: { ...cash, accepts_cash: acceptsCash, auto_open: event.target.checked } })} />
              Auto-open assigned drawer
            </label>
          </div>}
          {showHardware && discoveredPrinters.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {discoveredPrinters.map((printer) => {
                const endpoint = endpointFor(printer)
                return (
                  <div key={`${printer.vendor_id}:${printer.product_id}:${printer.device_id}`} className="rounded-lg border border-dash-border bg-[var(--glass-bg)] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-dash-cream">{printer.name || 'USB printer'}</span>
                      <Badge variant={endpoint ? 'success' : 'warning'}>{endpoint ? 'Configured' : 'Discovered — unassigned'}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-dash-tertiary">
                      USB {printer.vendor_id}:{printer.product_id}{printer.serial_number ? ` · serial ${printer.serial_number}` : ''} · {printer.has_permission ? 'permission ready' : 'permission needed'}
                    </p>
                    <p className="mt-1 text-[10px] text-dash-tertiary">{endpoint ? endpoint.name : 'Assign this printer from Manager → Daily Operations → USB Printer Agent on this terminal.'}</p>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FailoverTargetRow({ target, targets, busy, onSave }) {
  const policy = target.failover || {}
  const [action, setAction] = useState(policy.action || 'hold')
  const [backupTargetIds, setBackupTargetIds] = useState(() => policy.backup_target_ids?.length ? policy.backup_target_ids : policy.backup_target_id ? [policy.backup_target_id] : [])
  const [autoActivate, setAutoActivate] = useState(Boolean(policy.auto_activate))
  const isDown = target.last_test_status === 'failed'
  const isHealthy = ['healthy', 'passed', 'printed'].includes(target.last_test_status)
  const active = Boolean(policy.active)
  const eligibleBackups = targets.filter((candidate) => candidate.is_active && candidate.requires_failover !== false && candidate.id !== target.id)

  useEffect(() => {
    setAction(policy.action || 'hold')
    setBackupTargetIds(policy.backup_target_ids?.length ? policy.backup_target_ids : policy.backup_target_id ? [policy.backup_target_id] : [])
    setAutoActivate(Boolean(policy.auto_activate))
  }, [policy.action, policy.auto_activate, policy.backup_target_id, JSON.stringify(policy.backup_target_ids || [])])

  const normalizedBackupIds = backupTargetIds.filter(Boolean)
  const setBackupAt = (index, value) => {
    setBackupTargetIds((current) => {
      const next = [...current]
      next[index] = value
      return next.slice(0, 4)
    })
  }

  const submit = (nextActive = active) => onSave(target, {
    action,
    backup_target_id: action === 'reroute' ? normalizedBackupIds[0] || null : null,
    backup_target_ids: action === 'reroute' ? normalizedBackupIds : [],
    auto_activate: action === 'reroute' && autoActivate,
    active: action === 'reroute' && nextActive,
    reason: nextActive ? 'Manager activated printer outage reroute' : active ? 'Manager restored normal printer routing' : 'Manager configured printer outage policy',
  })

  const discard = () => {
    setAction(policy.action || 'hold')
    setBackupTargetIds(policy.backup_target_ids?.length ? policy.backup_target_ids : policy.backup_target_id ? [policy.backup_target_id] : [])
    setAutoActivate(Boolean(policy.auto_activate))
  }

  return (
    <div className={`rounded-xl border p-4 ${active ? 'border-dash-warning/60 bg-dash-warning/10' : isDown ? 'border-dash-danger/50 bg-dash-danger/10' : 'border-dash-border bg-[var(--glass-bg)]'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-dash-cream">{target.name}</span>
            {active ? <Badge variant="warning" dot>Rerouted</Badge> : isDown ? <Badge variant="danger" dot>Down</Badge> : isHealthy ? <Badge variant="success" dot>Ready</Badge> : <Badge variant="neutral" dot>Unknown</Badge>}
            {!policy.configured && <Badge variant="danger">Failover required</Badge>}
          </div>
          <p className="mt-1 text-xs text-dash-tertiary">
            {(target.stations || []).length ? `Print groups: ${target.stations.join(', ')}` : 'Not assigned to a print group'}
            {target.queued_count ? ` · ${target.queued_count} ticket${target.queued_count === 1 ? '' : 's'} waiting` : ''}
          </p>
          {target.last_test_error && isDown && <p className="mt-1 text-xs text-dash-danger">{target.last_test_error}</p>}
        </div>
        {active && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => submit(false)}>
            Restore normal routing
          </Button>
        )}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[150px_minmax(180px,1fr)_auto_auto] md:items-end">
        <SelectField label="If this printer fails" value={action} disabled={busy || active} onChange={(event) => setAction(event.target.value)}>
          <option value="hold">Hold & alert</option>
          <option value="reroute">Reroute to backup</option>
        </SelectField>
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <SelectField key={index} label={`Backup ${index + 1}`} value={backupTargetIds[index] || ''} disabled={busy || active || action !== 'reroute'} onChange={(event) => setBackupAt(index, event.target.value)}>
              <option value="">— none —</option>
              {eligibleBackups.filter((candidate) => !normalizedBackupIds.includes(candidate.id) || backupTargetIds[index] === candidate.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </SelectField>
          ))}
        </div>
        <label className={`flex min-h-[34px] items-center gap-2 text-xs text-dash-secondary ${action !== 'reroute' ? 'opacity-50' : ''}`}>
          <input type="checkbox" checked={autoActivate} disabled={busy || active || action !== 'reroute'} onChange={(event) => setAutoActivate(event.target.checked)} />
          Auto-reroute after a confirmed failure
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={busy || active} onClick={discard}>Cancel</Button>
          <Button variant="outline" size="sm" disabled={busy || active || (action === 'reroute' && !normalizedBackupIds.length)} onClick={() => submit(false)}>Save policy</Button>
          {action === 'reroute' && !active && (
            <Button size="sm" disabled={busy || !normalizedBackupIds.length} onClick={() => submit(true)}>Reroute now</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function PrinterFailoverSection({ status, busy, onRefresh, onSave }) {
  const targets = (status?.targets || []).filter((target) => target.is_active && target.requires_failover !== false)
  const devices = status?.devices || []
  const offlineDevices = devices.filter((device) => !isDeviceOnline(device))
  const needsSetup = Number(status?.unconfigured_count || 0)
  const downTargets = targets.filter((target) => target.last_test_status === 'failed')

  return (
    <Card className={needsSetup || downTargets.length ? 'border-dash-danger/50' : 'border-dash-success/30'}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle icon={needsSetup || downTargets.length ? AlertTriangle : ShieldCheck} title="Printer outage protection" />
          <p className="mt-1 max-w-3xl text-sm text-dash-secondary">Required production setup. Tickets are never silently discarded: hold them safely or send them to an explicitly chosen backup.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} icon={<RefreshCw size={14} aria-hidden="true" />}>Refresh status</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {needsSetup > 0 && (
          <div className="rounded-xl border border-dash-danger/50 bg-dash-danger/10 px-4 py-3 text-sm text-dash-danger">
            <strong>Action required:</strong> {needsSetup} active printer{needsSetup === 1 ? '' : 's'} still need an outage policy.
          </div>
        )}
        {offlineDevices.length > 0 && (
          <div className="rounded-xl border border-dash-warning/40 bg-dash-warning/10 px-4 py-3 text-sm text-dash-warning">
            Offline POS devices: {offlineDevices.map((device) => device.name).join(', ')}. Printer jobs bound to those devices may need rerouting.
          </div>
        )}
        {targets.length === 0 ? (
          <p className="text-sm text-dash-secondary">Add a production printer below before configuring outage protection.</p>
        ) : targets.map((target) => (
          <FailoverTargetRow key={target.id} target={target} targets={targets} busy={busy} onSave={onSave} />
        ))}
      </CardContent>
    </Card>
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
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)
  const [config, setConfig] = useState(null)
  const [failoverStatus, setFailoverStatus] = useState(null)
  const [legacyConfig, setLegacyConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pairingOpen, setPairingOpen] = useState(false)
  const [editingPrinterEndpoint, setEditingPrinterEndpoint] = useState(null)
  const [printerDraft, setPrinterDraft] = useState({ name: '', target_type: 'printer', connection_type: 'network', host: '', port: '' })
  const [groupDraft, setGroupDraft] = useState('')
  const [testStates, setTestStates] = useState({})

  const loadFailover = useCallback(async () => {
    if (!restaurantId) return
    try {
      setFailoverStatus(await fetchPrinterFailover(restaurantId))
    } catch (err) {
      setError(err.message || 'Could not load printer outage protection')
    }
  }, [restaurantId])

  const load = useCallback(async () => {
    if (!restaurantId) return
    try {
      const [cfg, legacy, failover] = await Promise.all([
        fetchStoreDeviceConfig(restaurantId),
        fetchLegacyPrinterConfig(restaurantId),
        fetchPrinterFailover(restaurantId).catch(() => null),
      ])
      setConfig(cfg)
      setLegacyConfig(legacy)
      setFailoverStatus(failover)
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadFailover()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [loadFailover])

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

  const mutateFailover = useCallback(async (target, policy) => {
    setBusy(true)
    setError(null)
    try {
      await savePrinterFailover(restaurantId, target.id, policy)
      await loadFailover()
    } catch (err) {
      setError(err.message || 'Could not update printer outage protection')
    } finally {
      setBusy(false)
    }
  }, [loadFailover, restaurantId])

  const printerTargets = useMemo(
    () => (config?.targets || []).filter((t) => t.is_active && t.target_type === 'printer'),
    [config?.targets]
  )
  const receiptTargets = useMemo(
    () => (config?.outputTargets || []).filter(
      (target) => target.is_active
        && (target.usage === 'receipt' || target.usage === 'both')
    ).sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0)),
    [config?.outputTargets]
  )
  const physicalPrinterTargets = useMemo(
    () => (failoverStatus?.targets || []).filter((target) => target.is_active && target.target_type === 'printer'),
    [failoverStatus?.targets]
  )
  const networkPrinterEndpoints = useMemo(
    () => (config?.printerEndpoints || []).filter((endpoint) => endpoint.connection_type === 'network'),
    [config?.printerEndpoints]
  )
  const physicalPrinterNames = useMemo(
    () => new Map((config?.outputTargets || []).map((target) => [target.id, target.name])),
    [config?.outputTargets]
  )
  const cashDrawerTargetIds = useMemo(() => new Set(
    (config?.devices || []).flatMap((device) => (device.printers || [])
      .filter((assignment) => assignment.role === 'cash_drawer')
      .map((assignment) => assignment.physical_target_id || assignment.target_id))
  ), [config?.devices])

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

  const { devices, targets, stations, categories, sections } = config

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-dash-danger/40 bg-dash-danger/10 px-4 py-3 text-sm text-dash-danger">
          {error}
        </div>
      )}

      {access.viewVisible('devices.hardware') && <HardwareChainGuide />}

      {access.viewVisible('devices.failover') && <PrinterFailoverSection
        status={failoverStatus}
        busy={busy}
        onRefresh={loadFailover}
        onSave={mutateFailover}
      />}

      {(access.viewVisible('devices.health') || access.viewVisible('devices.pairing') || access.viewVisible('devices.assignments') || access.viewVisible('devices.hardware')) && <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle icon={Monitor} title="Devices" count={devices.length} />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} icon={<RefreshCw size={14} aria-hidden="true" />}>
              Refresh
            </Button>
            {access.viewVisible('devices.pairing') && <Button size="sm" onClick={() => setPairingOpen(true)} icon={<Plus size={14} aria-hidden="true" />}>
              Add device
            </Button>}
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
              receiptTargets={receiptTargets}
              printerEndpoints={config.printerEndpoints}
              sections={sections}
              showAssignments={access.viewVisible('devices.assignments')}
              showHardware={access.viewVisible('devices.hardware')}
              busy={busy}
              onRename={(d, name) => mutate(() => updateDevice(d.id, { name }))}
              onSectionChange={(d, sectionId) => mutate(() => updateDevice(d.id, { revenue_center_id: sectionId }))}
              onPrinterChange={(d, role, targetId) => {
                const reason = role === 'receipt'
                  ? `Updated receipt printer for ${d.name || 'POS device'}`
                  : `Updated cash drawer printer connection for ${d.name || 'POS device'}`
                mutate(() => setDevicePrinter(restaurantId, d.id, role, targetId, reason))
              }}
              onHardwareChange={(d, hardwareConfig) => {
                mutate(() => saveDeviceHardwareConfig(
                  restaurantId,
                  d.id,
                  hardwareConfig,
                  `Updated terminal hardware settings for ${d.name || 'POS device'}`
                ))
              }}
              onToggleStatus={(d) => mutate(() => updateDevice(d.id, { status: d.status === 'revoked' ? 'active' : 'revoked' }))}
            />
          ))}
        </CardContent>
      </Card>}

      {access.viewVisible('devices.sessions') && <DeviceSessionPolicySection restaurantId={restaurantId} config={config} mutate={mutate} busy={busy} summary={access.viewMode('devices.sessions') === 'summary'} />}

      {(access.viewVisible('devices.assignments') || access.viewVisible('devices.network')) && <Card>
        <CardHeader>
          <SectionTitle icon={Printer} title="Printers & screens" count={targets.length} />
        </CardHeader>
        <CardContent className="space-y-3">
          {access.viewVisible('devices.network') && networkPrinterEndpoints.length > 0 && (
            <div className="rounded-xl border border-dash-border bg-[var(--glass-bg)] p-4">
              <p className="label-mono">Network printer IPs</p>
              <div className="mt-3 space-y-2">
                {networkPrinterEndpoints.map((endpoint) => (
                  <div key={endpoint.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-dash-border px-3 py-2">
                    <span className="text-sm font-semibold text-dash-cream">{physicalPrinterNames.get(endpoint.target_id) || endpoint.name}</span>
                    <span className="text-xs text-dash-tertiary">{endpoint.config?.host || 'No IP'}:{endpoint.config?.port || 9100}</span>
                    {!endpoint.is_active && <Badge variant="neutral">Inactive path</Badge>}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      disabled={busy}
                      onClick={() => setEditingPrinterEndpoint(endpoint)}
                      icon={<Pencil size={13} aria-hidden="true" />}
                    >
                      Edit IP
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {targets.map((target) => {
            const test = testStates[target.id]
            const canTest = target.is_active && target.target_type === 'printer' && Boolean(target.config?.host)
            const controlsDrawer = cashDrawerTargetIds.has(target.id)
            return (
              <div key={target.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-4 py-3">
                <span className="text-sm font-semibold text-dash-cream">{target.name}</span>
                <Badge variant="info">{TARGET_TYPES.find((t) => t.id === target.target_type)?.label || target.target_type}</Badge>
                <span className="text-xs text-dash-tertiary">
                  {CONNECTION_TYPES.find((c) => c.id === target.connection_type)?.label || target.connection_type}
                  {target.config?.host ? ` · ${target.config.host}${target.config.port ? `:${target.config.port}` : ''}` : ''}
                </span>
                {controlsDrawer && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-dash-secondary">
                    <label className="flex items-center gap-2">
                      <span>Connected through</span>
                      <select
                        value={target.config?.physical_target_id || ''}
                        disabled={busy}
                        onChange={(event) => {
                          mutate(() => saveCashDrawerTargetConfig(
                            restaurantId,
                            target.id,
                            { ...(target.config || {}), physical_target_id: event.target.value || null },
                            `Updated cash drawer printer path for ${target.name}`
                          ))
                        }}
                        className="min-h-[30px] rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 text-xs text-dash-cream"
                      >
                        <option value="">This target directly</option>
                        {physicalPrinterTargets.map((physical) => <option key={physical.id} value={physical.id}>{physical.name} · its ordered Ethernet/USB paths</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span>Drawer port</span>
                      <select
                        value={Number(target.config?.drawer?.port || 1)}
                        disabled={busy}
                        onChange={(event) => {
                          mutate(() => saveCashDrawerTargetConfig(restaurantId, target.id, {
                            ...(target.config || {}),
                            drawer: {
                              ...(target.config?.drawer || {}),
                              port: Number(event.target.value),
                              profile: target.config?.drawer?.profile || 'escpos_standard',
                              pulse_on_units: Number(target.config?.drawer?.pulse_on_units || 50),
                              pulse_off_units: Number(target.config?.drawer?.pulse_off_units || 250),
                            },
                          }, `Updated cash drawer port for ${target.name}`))
                        }}
                        className="min-h-[30px] rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 text-xs text-dash-cream"
                      >
                        <option value={1}>Drawer 1</option>
                        <option value={2}>Drawer 2</option>
                      </select>
                    </label>
                  </div>
                )}
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
                    onClick={() => mutate(() => updatePrinterTarget(restaurantId, target, { is_active: !target.is_active }))}
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
          {access.viewVisible('devices.network') && <div className="grid grid-cols-2 items-end gap-2 rounded-xl border border-dashed border-dash-border p-4 md:grid-cols-6">
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
          </div>}
        </CardContent>
      </Card>}

      {access.viewVisible('devices.print_groups') && <Card>
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
                          onChange={(e) => mutate(() => setGroupPrinter(restaurantId, station.id, target.id, e.target.checked))}
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
                      onChange={(e) => mutate(() => setCategoryPrintGroup(restaurantId, category.name, e.target.value || null))}
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
      </Card>}

      {access.viewVisible('devices.pairing') && <PairingModal
        restaurantId={restaurantId}
        isOpen={pairingOpen}
        onClose={() => { setPairingOpen(false); load() }}
      />}
      {access.viewVisible('devices.network') && <PrinterEndpointEditModal
        restaurantId={restaurantId}
        endpoint={editingPrinterEndpoint}
        onClose={() => setEditingPrinterEndpoint(null)}
        onSaved={load}
      />}
    </div>
  )
}
