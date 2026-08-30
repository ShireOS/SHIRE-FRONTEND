import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock3,
  Download,
  History,
  Library,
  MonitorSmartphone,
  RefreshCw,
  Rocket,
  Settings2,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../../auth'
import { Badge } from '../components/shared/Badge'
import { Button } from '../components/shared/Button'
import { Card, CardContent, CardHeader } from '../components/shared/Card'
import {
  cancelDeviceUpdateDeployment,
  createDeviceUpdateDeployment,
  createDeviceUpdateRelease,
  fetchDeviceUpdateAudit,
  fetchDeviceUpdateOverview,
  saveDeviceUpdatePolicy,
} from '../data/deviceUpdates'
import {
  deviceCompatibilityReasons,
  requestIdForDeploymentIntent,
  resetDeploymentRequestId,
} from '../data/deviceUpdateEligibility'

const PAGE_TABS = [
  { id: 'fleet', label: 'Fleet', icon: MonitorSmartphone },
  { id: 'rollout', label: 'New rollout', icon: Rocket },
  { id: 'releases', label: 'Releases', icon: Library },
  { id: 'policy', label: 'Policy', icon: Settings2 },
  { id: 'audit', label: 'Audit', icon: History },
]

export const ACTIVATION_POLICIES = [
  { id: 'asap_safe', label: 'ASAP — next safe point', detail: 'Mandatory now, but never during a payment, order save, print delivery, or unsynced queue.' },
  { id: 'after_close_day', label: '1 hour after Close Day', detail: 'Recommended. The timer starts only after a successful Close Day.' },
  { id: 'scheduled', label: 'Scheduled time', detail: 'Becomes eligible at your chosen time, then still waits for a safe point.' },
  { id: 'next_launch', label: 'Next launch', detail: 'Downloads now and activates the next time the POS is opened.' },
  { id: 'download_only', label: 'Download only', detail: 'Stages the bundle without forcing an activation.' },
]

const commandTone = (state) => {
  if (state === 'active') return 'success'
  if (['failed', 'incompatible'].includes(state)) return 'danger'
  if (state === 'cancelled') return 'neutral'
  if (state) return 'warning'
  return 'neutral'
}

const formatTime = (value) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—'

const humanize = (value) => String(value || 'not assigned').replaceAll('_', ' ')

function Stat({ label, value, tone = 'text-dash-cream' }) {
  return <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-dash-tertiary">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p></div>
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-dash-border p-8 text-center text-sm text-dash-secondary">{children}</div>
}

function FleetView({ overview }) {
  const devices = overview.devices || []
  const active = devices.filter(device => device.update_state === 'active').length
  const waiting = devices.filter(device => device.update_state && !['active', 'failed', 'incompatible', 'cancelled'].includes(device.update_state)).length
  const blocked = devices.filter(device => ['failed', 'incompatible'].includes(device.update_state)).length
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Paired devices" value={devices.length} />
      <Stat label="On desired release" value={active} tone="text-emerald-300" />
      <Stat label="Pending safe point" value={waiting} tone="text-amber-200" />
      <Stat label="Needs attention" value={blocked} tone={blocked ? 'text-red-300' : 'text-dash-cream'} />
    </div>
    <Card>
      <CardHeader><div className="flex items-center justify-between"><div><h2 className="font-semibold text-dash-cream">Device update status</h2><p className="mt-1 text-sm text-dash-secondary">Activation status is acknowledged by the device after the new bundle starts.</p></div><ShieldCheck className="text-dash-gold" size={22} /></div></CardHeader>
      <CardContent className="p-0">
        {devices.length === 0 ? <div className="p-6"><Empty>No paired devices found.</Empty></div> : <div className="divide-y divide-dash-border">
          {devices.map(device => <div key={device.id} className="grid gap-3 p-5 lg:grid-cols-[1.2fr_.8fr_1fr_1.3fr] lg:items-center">
            <div><p className="font-semibold text-dash-cream">{device.name}</p><p className="mt-1 text-xs text-dash-tertiary">{humanize(device.device_type)} · last seen {formatTime(device.last_seen_at)}</p></div>
            <div><p className="text-xs text-dash-tertiary">Current app</p><p className="mt-1 font-mono text-sm text-dash-secondary">{device.app_version || 'Unknown'}</p></div>
            <div><p className="text-xs text-dash-tertiary">Desired release</p><p className="mt-1 text-sm text-dash-cream">{device.desired_version || 'No command'}</p></div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant={commandTone(device.update_state)}>{humanize(device.update_state || 'current')}</Badge>{device.blocker_code ? <span className="text-xs text-amber-200">{humanize(device.blocker_code)}</span> : null}{device.error_code ? <span className="text-xs text-red-300">{humanize(device.error_code)}</span> : null}</div>
          </div>)}
        </div>}
      </CardContent>
    </Card>
  </div>
}

function RolloutView({ restaurantId, overview, onChanged }) {
  const releases = (overview.releases || []).filter(release => release.artifact_kind === 'ota' && ['ios', 'android'].includes(release.platform))
  const devices = (overview.devices || []).filter(device => device.status === 'active')
  const [releaseId, setReleaseId] = useState(releases[0]?.id || '')
  const [policy, setPolicy] = useState(overview.policy?.default_activation_policy || 'after_close_day')
  const [scheduledFor, setScheduledFor] = useState('')
  const [selected, setSelected] = useState([])
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const requestIdRef = useRef(null)
  const release = releases.find(item => item.id === releaseId)
  const compatibleDevices = devices.filter(device => deviceCompatibilityReasons(device, release).length === 0)
  const incompatibleDevices = devices.filter(device => deviceCompatibilityReasons(device, release).length > 0)
  const compatibleDeviceIds = new Set(compatibleDevices.map(device => device.id))
  const targetDeviceIds = selected.length === 0 ? [...compatibleDeviceIds] : selected.filter(id => compatibleDeviceIds.has(id))
  useEffect(() => { if (!releaseId && releases[0]?.id) setReleaseId(releases[0].id) }, [releaseId, releases])
  const deploymentIntent = {
    release_id: releaseId,
    activation_policy: policy,
    scheduled_for: policy === 'scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
    mandatory: policy !== 'download_only',
    device_ids: targetDeviceIds,
    reason: reason.trim(),
  }
  const mutation = useMutation({
    mutationFn: () => createDeviceUpdateDeployment(restaurantId, {
      request_id: requestIdForDeploymentIntent(requestIdRef, deploymentIntent),
      ...deploymentIntent,
    }),
    onSuccess: () => { resetDeploymentRequestId(requestIdRef); setReason(''); setConfirmed(false); setSelected([]); onChanged(); },
  })
  const canSubmit = releaseId && targetDeviceIds.length > 0 && reason.trim().length >= 3 && confirmed && (policy !== 'scheduled' || scheduledFor)
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
    <Card><CardHeader><h2 className="font-semibold text-dash-cream">Create rollout</h2><p className="mt-1 text-sm text-dash-secondary">Choose the release, devices, and when it becomes eligible. Device safety gates always have final authority.</p></CardHeader><CardContent className="space-y-6">
      <label className="block"><span className="font-mono text-[10px] uppercase tracking-wider text-dash-tertiary">Approved OTA release</span><select value={releaseId} onChange={event => { setReleaseId(event.target.value); setSelected([]) }} className="mt-2 w-full rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-sm text-dash-cream"><option value="">Choose a release…</option>{releases.map(release => <option key={release.id} value={release.id}>{release.version_label} · {release.platform.toUpperCase()} · runtime {release.runtime_version}</option>)}</select><span className="mt-2 block text-xs text-dash-secondary">Each Expo update ID belongs to one platform. Publish and approve separate iOS and Android release records.</span></label>
      <fieldset><legend className="font-mono text-[10px] uppercase tracking-wider text-dash-tertiary">Activation policy</legend><div className="mt-2 grid gap-2">{ACTIVATION_POLICIES.map(option => <label key={option.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${policy === option.id ? 'border-dash-gold/60 bg-dash-gold/5' : 'border-dash-border'}`}><input type="radio" name="activation-policy" value={option.id} checked={policy === option.id} onChange={() => setPolicy(option.id)} className="mt-1 accent-[#d4a854]"/><span><span className="block text-sm font-semibold text-dash-cream">{option.label}</span><span className="mt-1 block text-xs leading-5 text-dash-secondary">{option.detail}</span></span></label>)}</div></fieldset>
      {policy === 'scheduled' ? <label className="block"><span className="text-sm text-dash-secondary">Eligible at</span><input type="datetime-local" value={scheduledFor} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} onChange={event => setScheduledFor(event.target.value)} className="mt-2 w-full rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream" /></label> : null}
      <fieldset><legend className="font-mono text-[10px] uppercase tracking-wider text-dash-tertiary">Target devices</legend><p className="mt-1 text-xs text-dash-secondary">No boxes selected targets every device that has recently proved the selected platform, runtime, and channel. Incompatible or unreported devices are never sent the command.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{devices.map(device => { const reasons = deviceCompatibilityReasons(device, release); const compatible = reasons.length === 0; return <label key={device.id} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${compatible ? 'border-dash-border text-dash-cream' : 'border-red-300/20 text-dash-tertiary'}`}><input type="checkbox" disabled={!compatible} checked={compatible && selected.includes(device.id)} onChange={() => setSelected(current => current.includes(device.id) ? current.filter(id => id !== device.id) : [...current, device.id])} className="mt-0.5 accent-[#d4a854]" /><span><span className="block">{device.name}</span><span className="mt-1 block text-[11px]">{compatible ? `${device.update_platform} · runtime ${device.update_runtime_version} · ${device.update_channel}` : reasons.map(humanize).join(', ')}</span></span></label> })}</div>{incompatibleDevices.length ? <p className="mt-3 text-xs text-amber-200">{incompatibleDevices.length} active device{incompatibleDevices.length === 1 ? '' : 's'} will not be targeted until a compatible native build reports fresh update capability.</p> : null}</fieldset>
      <label className="block"><span className="text-sm text-dash-secondary">Audit reason</span><textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} placeholder="Why is this release being sent?" className="mt-2 w-full rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-sm text-dash-cream" /></label>
      <label className="flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1 accent-[#d4a854]" /><span>I understand that “force” makes the update mandatory, but the POS will still refuse to restart during payment, order persistence, required print delivery, or unsynced work.</span></label>
      {mutation.error ? <p role="alert" className="text-sm text-red-300">{mutation.error.message}</p> : null}
      <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} icon={<Rocket size={15} />}>{mutation.isPending ? 'Creating rollout…' : policy === 'download_only' ? 'Stage download' : 'Create mandatory rollout'}</Button>
    </CardContent></Card>
    <div className="space-y-4"><Card><CardContent><ShieldCheck className="text-emerald-300" size={25}/><h3 className="mt-3 font-semibold text-dash-cream">Safety is device-local</h3><p className="mt-2 text-sm leading-6 text-dash-secondary">Back Office can make a release mandatory. It cannot bypass the local payment, order, printing, or offline-queue gates.</p></CardContent></Card><Card><CardContent><Clock3 className="text-dash-gold" size={25}/><h3 className="mt-3 font-semibold text-dash-cream">Close Day means Close Day</h3><p className="mt-2 text-sm leading-6 text-dash-secondary">The one-hour timer is committed with successful Close Day. Clock-out state is not consulted.</p></CardContent></Card></div>
  </div>
}

function ReleasesView({ restaurantId, overview, onChanged }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ version_label: '', artifact_kind: 'ota', platform: 'ios', runtime_version: '', channel: '', expo_update_id: '', native_version: '', native_build: '', git_commit: '', release_notes: '' })
  const isPlatformAdmin = auth.accountType === 'admin'
  const mutation = useMutation({
    mutationFn: () => createDeviceUpdateRelease(restaurantId, {
      ...form,
      release_notes: form.release_notes || '',
      runtime_version: form.artifact_kind === 'ota' ? form.runtime_version : null,
      channel: form.artifact_kind === 'ota' ? form.channel : null,
      expo_update_id: form.artifact_kind === 'ota' ? form.expo_update_id : null,
      native_version: form.artifact_kind === 'native' ? form.native_version : null,
      native_build: form.artifact_kind === 'native' ? form.native_build : null,
      git_commit: form.git_commit || null,
    }),
    onSuccess: () => { setOpen(false); onChanged(); },
  })
  const canApprove = form.version_label.trim()
    && form.platform
    && (form.artifact_kind === 'ota'
      ? form.runtime_version.trim() && form.channel.trim() && form.expo_update_id.trim()
      : form.native_version.trim() && form.native_build.trim())
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-dash-cream">Approved releases</h2><p className="mt-1 text-sm text-dash-secondary">Resellers and owners can deploy approved artifacts; only platform admins can approve a new artifact.</p></div>{isPlatformAdmin ? <Button onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Approve release'}</Button> : null}</div>
    {open ? <Card><CardContent className="grid gap-3 md:grid-cols-2"><input value={form.version_label} onChange={event => setForm({ ...form, version_label: event.target.value })} placeholder="Version label" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"/><select value={form.artifact_kind} onChange={event => setForm({ ...form, artifact_kind: event.target.value })} className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"><option value="ota">EAS Update OTA bundle</option><option value="native">EAS Build native installer record</option></select><select value={form.platform} onChange={event => setForm({ ...form, platform: event.target.value })} className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"><option value="ios">iOS</option><option value="android">Android</option></select>{form.artifact_kind === 'ota' ? <><input value={form.runtime_version} onChange={event => setForm({ ...form, runtime_version: event.target.value })} placeholder="Runtime version" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"/><input value={form.channel} onChange={event => setForm({ ...form, channel: event.target.value })} placeholder="Dedicated EAS channel" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"/><input value={form.expo_update_id} onChange={event => setForm({ ...form, expo_update_id: event.target.value })} placeholder="Exact Expo update ID" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"/></> : <><input value={form.native_version} onChange={event => setForm({ ...form, native_version: event.target.value })} placeholder="Native app version" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"/><input value={form.native_build} onChange={event => setForm({ ...form, native_build: event.target.value })} placeholder="EAS build number" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"/><p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100 md:col-span-2">This records an EAS Build artifact only. It is not eligible for a Back Office rollout until an MDM or managed app-store installer is connected; EAS Build does not silently replace a running native app.</p></>}<input value={form.git_commit} onChange={event => setForm({ ...form, git_commit: event.target.value })} placeholder="Git commit" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream"/><textarea value={form.release_notes} onChange={event => setForm({ ...form, release_notes: event.target.value })} placeholder="Release notes" className="rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream md:col-span-2"/>{mutation.error ? <p role="alert" className="text-sm text-red-300 md:col-span-2">{mutation.error.message}</p> : null}<Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canApprove}>{mutation.isPending ? 'Approving…' : 'Approve immutable release'}</Button></CardContent></Card> : null}
    <div className="grid gap-4 lg:grid-cols-2">{(overview.releases || []).map(release => <Card key={release.id}><CardContent><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold text-dash-cream">{release.version_label}</p><p className="mt-1 text-xs text-dash-tertiary">{release.artifact_kind.toUpperCase()} · {release.platform} · approved {formatTime(release.approved_at)}</p></div><Badge variant={release.status === 'approved' ? 'success' : 'neutral'}>{release.status}</Badge></div><dl className="mt-4 grid gap-2 text-xs text-dash-secondary"><div><dt className="inline text-dash-tertiary">Runtime: </dt><dd className="inline font-mono">{release.runtime_version || 'native'}</dd></div><div><dt className="inline text-dash-tertiary">Channel: </dt><dd className="inline font-mono">{release.channel || '—'}</dd></div><div><dt className="inline text-dash-tertiary">Exact update ID: </dt><dd className="break-all font-mono">{release.expo_update_id || '—'}</dd></div></dl>{release.artifact_kind === 'native' ? <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">Catalog only: install this EAS Build through an MDM or managed store. It cannot be sent as an OTA rollout.</p> : null}{release.release_notes ? <p className="mt-4 text-sm leading-6 text-dash-secondary">{release.release_notes}</p> : null}</CardContent></Card>)}{(overview.releases || []).length === 0 ? <Empty>No approved releases yet.</Empty> : null}</div>
  </div>
}

function PolicyView({ restaurantId, overview, onChanged }) {
  const [policy, setPolicy] = useState(overview.policy?.default_activation_policy || 'after_close_day')
  const mutation = useMutation({ mutationFn: () => saveDeviceUpdatePolicy(restaurantId, { default_activation_policy: policy, close_day_delay_minutes: 60 }), onSuccess: onChanged })
  return <Card><CardHeader><h2 className="font-semibold text-dash-cream">Restaurant default</h2><p className="mt-1 text-sm text-dash-secondary">This preselects the rollout composer. It never removes the device safety gate.</p></CardHeader><CardContent className="space-y-5"><select value={policy} onChange={event => setPolicy(event.target.value)} className="w-full rounded-xl border border-dash-border bg-dash-base px-3 py-3 text-dash-cream">{ACTIVATION_POLICIES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><div className="rounded-xl border border-dash-gold/20 bg-dash-gold/5 p-4"><p className="font-semibold text-dash-cream">Close Day delay: 60 minutes</p><p className="mt-1 text-sm text-dash-secondary">Fixed by the current safety policy. No clock-out trigger is used.</p></div>{mutation.error ? <p role="alert" className="text-sm text-red-300">{mutation.error.message}</p> : null}<Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save default'}</Button></CardContent></Card>
}

function AuditView({ restaurantId }) {
  const query = useQuery({ queryKey: ['device-updates', restaurantId, 'audit'], queryFn: ({ signal }) => fetchDeviceUpdateAudit(restaurantId, signal), staleTime: 30_000 })
  if (query.isLoading) return <p className="text-sm text-dash-secondary">Loading audit history…</p>
  if (query.error) return <p role="alert" className="text-sm text-red-300">{query.error.message}</p>
  return <Card><CardHeader><h2 className="font-semibold text-dash-cream">Immutable audit trail</h2></CardHeader><CardContent className="p-0">{(query.data?.items || []).length === 0 ? <div className="p-6"><Empty>No update events yet.</Empty></div> : <div className="divide-y divide-dash-border">{query.data.items.map(item => <div key={item.id} className="grid gap-2 p-5 md:grid-cols-[180px_1fr_200px]"><p className="text-xs text-dash-tertiary">{formatTime(item.created_at)}</p><div><p className="text-sm font-semibold text-dash-cream">{humanize(item.event_type)}</p><p className="mt-1 text-xs text-dash-secondary">{item.reason || item.details?.to || 'Recorded control-plane event'}</p></div><p className="text-xs text-dash-secondary">{item.actor_name} · {humanize(item.actor_type)}</p></div>)}</div>}</CardContent></Card>
}

function DeploymentHistory({ restaurantId, deployments, onChanged }) {
  const queryClient = useQueryClient()
  const cancel = useMutation({ mutationFn: ({ id, reason }) => cancelDeviceUpdateDeployment(restaurantId, id, reason), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['device-updates', restaurantId] }); onChanged() } })
  const cancelDeployment = (deployment) => {
    const reason = window.prompt(`Why are you cancelling ${deployment.version_label}?`)
    if (reason?.trim().length >= 3) cancel.mutate({ id: deployment.id, reason: reason.trim() })
  }
  return <Card><CardHeader><h2 className="font-semibold text-dash-cream">Recent rollouts</h2></CardHeader><CardContent className="p-0">{deployments.length === 0 ? <div className="p-6"><Empty>No rollouts yet.</Empty></div> : <div className="divide-y divide-dash-border">{deployments.map(deployment => <div key={deployment.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center"><div><p className="font-semibold text-dash-cream">{deployment.version_label}</p><p className="mt-1 text-xs text-dash-tertiary">{formatTime(deployment.created_at)} · {deployment.created_by_name}</p></div><div><Badge variant={deployment.status === 'active' ? 'warning' : 'neutral'}>{deployment.status}</Badge><p className="mt-1 text-xs text-dash-secondary">{humanize(deployment.activation_policy)}</p></div><p className="text-sm text-dash-secondary">{deployment.active_count}/{deployment.device_count} active · {deployment.pending_count} pending · {deployment.failed_count} attention</p>{deployment.status === 'active' && deployment.pending_count > 0 ? <Button variant="secondary" size="sm" onClick={() => cancelDeployment(deployment)}>Cancel</Button> : null}</div>)}</div>}</CardContent></Card>
}

export default function DeviceUpdatesPage({ restaurantId }) {
  const [activeTab, setActiveTab] = useState('fleet')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['device-updates', restaurantId, 'overview'], queryFn: ({ signal }) => fetchDeviceUpdateOverview(restaurantId, signal), enabled: Boolean(restaurantId), staleTime: 30_000, refetchOnWindowFocus: true })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['device-updates', restaurantId] })
  const overview = query.data || { policy: {}, devices: [], deployments: [], releases: [] }
  const activeRelease = useMemo(() => overview.releases.find(release => release.status === 'approved'), [overview.releases])
  if (query.isLoading) return <div className="flex min-h-52 items-center justify-center"><RefreshCw className="animate-spin text-dash-gold" /></div>
  if (query.error) return <div role="alert" className="rounded-xl border border-red-300/20 bg-red-300/5 p-5 text-red-200"><div className="flex items-center gap-2 font-semibold"><XCircle size={18}/>Device Updates unavailable</div><p className="mt-2 text-sm">{query.error.message}</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></div>
  return <div className="space-y-6">
    <section className="rounded-2xl border border-dash-border bg-gradient-to-br from-white/[0.045] to-transparent p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Download className="text-dash-gold" size={21}/><h1 className="text-xl font-semibold text-dash-cream">Device Updates</h1></div><p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">Release control for POS devices. Mandatory means the device cannot ignore the update; safe point means it still cannot interrupt money, orders, printing, or unsynced work.</p></div><div className="flex items-center gap-2"><Badge variant={activeRelease ? 'success' : 'warning'}>{activeRelease ? `${activeRelease.version_label} approved` : 'No approved release'}</Badge><Button variant="secondary" size="sm" onClick={() => query.refetch()} icon={<RefreshCw size={14}/>}>Refresh</Button></div></div></section>
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-dash-border bg-white/[0.025] p-1" aria-label="Device update sections">{PAGE_TABS.map(tab => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold ${activeTab === tab.id ? 'bg-dash-gold/10 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'}`}><Icon size={15}/>{tab.label}</button> })}</nav>
    {activeTab === 'fleet' ? <><FleetView overview={overview}/><DeploymentHistory restaurantId={restaurantId} deployments={overview.deployments || []} onChanged={refresh}/></> : null}
    {activeTab === 'rollout' ? <RolloutView restaurantId={restaurantId} overview={overview} onChanged={refresh}/> : null}
    {activeTab === 'releases' ? <ReleasesView restaurantId={restaurantId} overview={overview} onChanged={refresh}/> : null}
    {activeTab === 'policy' ? <PolicyView restaurantId={restaurantId} overview={overview} onChanged={refresh}/> : null}
    {activeTab === 'audit' ? <AuditView restaurantId={restaurantId}/> : null}
  </div>
}
