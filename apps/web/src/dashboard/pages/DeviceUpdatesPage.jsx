import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  Download,
  History,
  Library,
  MonitorSmartphone,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Rocket,
  ShieldCheck,
  SkipForward,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../../auth'
import { fetchResellerPortfolioForUser } from '../../reseller/data/resellerPortfolio'
import { Badge } from '../components/shared/Badge'
import { Button } from '../components/shared/Button'
import { Card, CardContent, CardHeader } from '../components/shared/Card'
import {
  createManagedUpdateRollout,
  fetchDeviceUpdateAudit,
  fetchDeviceUpdateOverview,
  fetchManagedUpdateFleet,
  fetchManagedUpdateReleases,
  fetchManagedUpdateRollout,
  fetchManagedUpdateRollouts,
  mutateManagedUpdateRelease,
  mutateManagedUpdateRollout,
  mutateManagedUpdateTarget,
  previewManagedUpdateRollout,
  saveDeviceUpdatePolicy,
} from '../data/deviceUpdates'
import {
  effectiveTargetState,
  humanizeUpdateCode,
  managedUpdateErrorCode,
  managedUpdateIntentFingerprint,
  normalizeRolloutScope,
  previewChanges,
  requestIdForDeploymentIntent,
  resetDeploymentRequestId,
} from '../data/deviceUpdateEligibility'

const PAGE_TABS = [
  { id: 'fleet', label: 'Fleet', icon: MonitorSmartphone },
  { id: 'compose', label: 'New rollout', icon: Rocket },
  { id: 'rollouts', label: 'Rollouts', icon: History },
  { id: 'releases', label: 'Releases', icon: Library },
  { id: 'policy', label: 'Policy', icon: Clock3 },
  { id: 'audit', label: 'V1 audit', icon: ShieldCheck },
]

export const ACTIVATION_POLICIES = [
  {
    id: 'asap_safe',
    label: 'ASAP — next safe point',
    detail:
      'Start immediately, but never interrupt payments, orders, print delivery, or unsynced work.',
  },
  {
    id: 'after_close_day',
    label: '1 hour after Close Day',
    detail:
      'The timer starts only after a successful Close Day and still respects every terminal safety gate.',
  },
  {
    id: 'scheduled',
    label: 'Scheduled time',
    detail:
      'Become eligible at a chosen time, then wait for the next safe point.',
  },
  {
    id: 'next_launch',
    label: 'Next launch',
    detail: 'Download now and activate in a later app session.',
  },
  {
    id: 'download_only',
    label: 'Download only',
    detail: 'Stage the exact bundle without requesting activation.',
  },
]

const inputClass =
  'w-full rounded-xl border border-dash-border bg-dash-base px-3 py-2.5 text-sm text-dash-cream outline-none focus:border-dash-gold/60'

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'

const formatLocalDateTimeInput = (value) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

const isOtaDeployableRelease = (release) =>
  release.status === 'approved' &&
  release.ota_deployable &&
  Boolean(release.source_eas_group_id) &&
  Boolean(release.artifacts?.length) &&
  release.artifacts.every((artifact) => artifact.artifact_kind === 'ota')

const toneForState = (state) => {
  if (state === 'active' || state === 'completed' || state === 'approved')
    return 'success'
  if (['failed', 'incompatible', 'revoked'].includes(state)) return 'danger'
  if (
    ['paused', 'waiting_safe_point', 'preparing', 'ready', 'released'].includes(
      state,
    )
  ) {
    return 'warning'
  }
  return 'neutral'
}

const errorMessage = (error) => {
  if (!error) return ''
  const detail = error.detail
  if (detail && typeof detail === 'object' && detail.message)
    return detail.message
  return error.message || 'The update operation failed.'
}

function Empty({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-dash-border p-8 text-center text-sm text-dash-secondary">
      {children}
    </div>
  )
}

function Stat({ label, value, tone = 'text-dash-cream' }) {
  return (
    <div className="rounded-xl border border-dash-border bg-white/[0.025] p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-dash-tertiary">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

function ScopePicker({
  restaurantId,
  groups,
  scopeMode,
  groupId,
  onScopeMode,
  onGroupId,
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label>
        <span className="text-xs font-semibold text-dash-secondary">
          Target scope
        </span>
        <select
          value={scopeMode}
          onChange={(event) => onScopeMode(event.target.value)}
          className={inputClass}
        >
          <option value="store">Current store</option>
          {groups.length ? <option value="group">Reseller group</option> : null}
        </select>
      </label>
      {scopeMode === 'group' ? (
        <label>
          <span className="text-xs font-semibold text-dash-secondary">
            Authorized reseller group
          </span>
          <select
            value={groupId}
            onChange={(event) => onGroupId(event.target.value)}
            className={inputClass}
          >
            <option value="">Choose a group…</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="rounded-xl border border-dash-border bg-white/[0.02] px-3 py-2.5 text-sm text-dash-secondary">
          Store ID{' '}
          <span className="font-mono text-dash-cream">{restaurantId}</span>
        </div>
      )}
    </div>
  )
}

function FleetFilters({ filters, onChange, releases }) {
  const set = (key, value) => onChange({ ...filters, [key]: value })
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <select
        value={filters.release_family_id}
        onChange={(e) => set('release_family_id', e.target.value)}
        className={inputClass}
      >
        <option value="">Eligibility without a release</option>
        {releases.map((release) => (
          <option key={release.id} value={release.id}>
            Eligible for {release.version_label}
          </option>
        ))}
      </select>
      <select
        value={filters.platform}
        onChange={(e) => set('platform', e.target.value)}
        className={inputClass}
      >
        <option value="">All platforms</option>
        <option value="ios">iOS</option>
        <option value="android">Android</option>
      </select>
      <input
        value={filters.runtime_version}
        onChange={(e) => set('runtime_version', e.target.value)}
        placeholder="Runtime version"
        className={inputClass}
      />
      <select
        value={filters.protocol_version}
        onChange={(e) => set('protocol_version', e.target.value)}
        className={inputClass}
      >
        <option value="">All protocols</option>
        <option value="2">Protocol V2</option>
        <option value="1">Protocol V1</option>
      </select>
      <select
        value={filters.online}
        onChange={(e) => set('online', e.target.value)}
        className={inputClass}
      >
        <option value="">Online and offline</option>
        <option value="true">Online within 5 minutes</option>
        <option value="false">Offline</option>
      </select>
      <select
        value={filters.capability_fresh}
        onChange={(e) => set('capability_fresh', e.target.value)}
        className={inputClass}
      >
        <option value="">Any capability age</option>
        <option value="true">Fresh within 30 days</option>
        <option value="false">Missing or stale</option>
      </select>
      <select
        value={filters.eligible}
        onChange={(e) => set('eligible', e.target.value)}
        className={inputClass}
      >
        <option value="">Eligible and excluded</option>
        <option value="true">Eligible only</option>
        <option value="false">Excluded only</option>
      </select>
      <input
        value={filters.current_release}
        onChange={(e) => set('current_release', e.target.value)}
        placeholder="Current release contains…"
        className={inputClass}
      />
    </div>
  )
}

function FleetTable({
  devices,
  selectable = false,
  allEligible = true,
  selected = [],
  onToggle,
}) {
  const selectedSet = new Set(selected)
  if (!devices.length)
    return <Empty>No devices match this authorized filter.</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-dash-border font-mono text-[10px] uppercase tracking-wider text-dash-tertiary">
          <tr>
            {selectable ? <th className="px-4 py-3">Select</th> : null}
            <th className="px-4 py-3">Device / store</th>
            <th className="px-4 py-3">Platform / runtime</th>
            <th className="px-4 py-3">Protocol / capability</th>
            <th className="px-4 py-3">Running release</th>
            <th className="px-4 py-3">Presence</th>
            <th className="px-4 py-3">Eligibility</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dash-border">
          {devices.map((device) => {
            const checked =
              device.eligible && (allEligible || selectedSet.has(device.id))
            return (
              <tr key={device.id} className="align-top">
                {selectable ? (
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${device.name}`}
                      disabled={!device.eligible}
                      checked={checked}
                      onChange={() => onToggle(device)}
                      className="accent-[#d4a854]"
                    />
                  </td>
                ) : null}
                <td className="px-4 py-4">
                  <p className="font-semibold text-dash-cream">{device.name}</p>
                  <p className="mt-1 text-xs text-dash-tertiary">
                    {device.restaurant_name}
                  </p>
                </td>
                <td className="px-4 py-4 text-dash-secondary">
                  <p>{device.platform?.toUpperCase() || 'Unknown platform'}</p>
                  <p className="mt-1 font-mono text-xs">
                    {device.runtime_version || 'Unknown runtime'}
                  </p>
                </td>
                <td className="px-4 py-4 text-dash-secondary">
                  <p>V{device.protocol_version || '—'}</p>
                  <p className="mt-1 text-xs">
                    {formatTime(device.capability_reported_at)}
                  </p>
                </td>
                <td className="px-4 py-4 text-dash-secondary">
                  <p>{device.current_version_label || 'Unknown release'}</p>
                  <p className="mt-1 max-w-52 break-all font-mono text-[11px]">
                    {device.running_update_id || 'No update ID'}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={device.online ? 'success' : 'neutral'}>
                    {device.online ? 'Online' : 'Offline'}
                  </Badge>
                  <p className="mt-2 text-xs text-dash-tertiary">
                    {formatTime(device.last_seen_at)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={device.eligible ? 'success' : 'danger'}>
                    {device.eligible ? 'Eligible' : 'Excluded'}
                  </Badge>
                  {!device.eligible ? (
                    <ul className="mt-2 space-y-1 text-xs text-red-200">
                      {(device.eligibility_reasons || []).map((reason) => (
                        <li key={reason}>{humanizeUpdateCode(reason)}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FleetWorkspace({ scope, scopePicker, releases }) {
  const [filters, setFilters] = useState({
    release_family_id: '',
    platform: '',
    runtime_version: '',
    protocol_version: '',
    online: '',
    capability_fresh: '',
    eligible: '',
    current_release: '',
  })
  const serverFilters = { ...filters }
  delete serverFilters.current_release
  const query = useQuery({
    queryKey: ['device-updates-v2', 'fleet', scope, serverFilters],
    queryFn: ({ signal }) =>
      fetchManagedUpdateFleet(
        scope.restaurant_ids[0] || scopePicker.restaurantId,
        scope,
        serverFilters,
        signal,
      ),
    enabled: Boolean(
      scope.restaurant_ids.length || scope.reseller_group_ids.length,
    ),
    staleTime: 30_000,
  })
  const devices = (query.data?.devices || []).filter((device) =>
    String(device.current_version_label || '')
      .toLowerCase()
      .includes(filters.current_release.toLowerCase()),
  )
  const online = devices.filter((device) => device.online).length
  const eligible = devices.filter((device) => device.eligible).length
  const stale = devices.filter((device) => !device.capability_fresh).length
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-dash-cream">
            Authorized fleet scope
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {scopePicker.node}
          <FleetFilters
            filters={filters}
            onChange={setFilters}
            releases={releases}
          />
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Filtered devices" value={devices.length} />
        <Stat label="Online ≤ 5 min" value={online} tone="text-emerald-300" />
        <Stat label="Eligible" value={eligible} tone="text-dash-gold" />
        <Stat
          label="Stale capability"
          value={stale}
          tone={stale ? 'text-red-300' : 'text-dash-cream'}
        />
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-dash-cream">Fleet identity</h2>
              <p className="mt-1 text-sm text-dash-secondary">
                Online status and 30-day capability eligibility are
                intentionally separate.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => query.refetch()}
              icon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <p className="p-6 text-sm text-dash-secondary">Loading fleet…</p>
          ) : null}
          {query.error ? (
            <p role="alert" className="p-6 text-sm text-red-300">
              {errorMessage(query.error)}
            </p>
          ) : null}
          {!query.isLoading && !query.error ? (
            <FleetTable devices={devices} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function PreviewPanel({ preview, changes }) {
  if (!preview) return null
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-dash-cream">
              Authoritative preview
            </h3>
            <p className="mt-1 text-xs text-dash-tertiary">
              Generated {formatTime(preview.generated_at)} · token{' '}
              {preview.preview_token?.slice(0, 12)}…
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="success">{preview.eligible_count} eligible</Badge>
            <Badge variant={preview.excluded_count ? 'danger' : 'neutral'}>
              {preview.excluded_count} excluded
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {changes.added || changes.removed || changes.changed ? (
          <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">
            Since the previous preview: {changes.added} added, {changes.removed}{' '}
            removed, {changes.changed} eligibility or wave changes.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(preview.cohorts || []).flatMap((cohort) =>
            Object.entries(cohort.waves || {}).map(([wave, count]) => (
              <div
                key={`${cohort.platform}-${cohort.runtime_version}-${wave}`}
                className="rounded-xl border border-dash-border p-3 text-sm"
              >
                <p className="font-semibold text-dash-cream">
                  {cohort.platform.toUpperCase()} · {cohort.runtime_version}
                </p>
                <p className="mt-1 text-dash-secondary">
                  Wave {wave}: {count} device{count === 1 ? '' : 's'}
                </p>
              </div>
            )),
          )}
        </div>
        <FleetTable devices={preview.devices || []} />
      </CardContent>
    </Card>
  )
}

function RolloutComposer({
  restaurantId,
  scope,
  scopePicker,
  releases,
  onCreated,
}) {
  const deployable = releases.filter(isOtaDeployableRelease)
  const [releaseId, setReleaseId] = useState('')
  const [policy, setPolicy] = useState('after_close_day')
  const [scheduledFor, setScheduledFor] = useState('')
  const [allEligible, setAllEligible] = useState(true)
  const [selected, setSelected] = useState([])
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [preview, setPreview] = useState(null)
  const [changes, setChanges] = useState({ added: 0, removed: 0, changed: 0 })
  const previousPreviewRef = useRef(null)
  const requestIdRef = useRef(null)
  const fleetQuery = useQuery({
    queryKey: ['device-updates-v2', 'composer-fleet', scope, releaseId],
    queryFn: ({ signal }) =>
      fetchManagedUpdateFleet(
        restaurantId,
        scope,
        { release_family_id: releaseId },
        signal,
      ),
    enabled: Boolean(
      releaseId &&
      (scope.restaurant_ids.length || scope.reseller_group_ids.length),
    ),
    staleTime: 15_000,
  })
  const devices = fleetQuery.data?.devices || []
  const eligibleIds = devices
    .filter((device) => device.eligible)
    .map((device) => device.id)
  const selectionCount = allEligible
    ? eligibleIds.length
    : selected.filter((id) => eligibleIds.includes(id)).length
  const targetScope = normalizeRolloutScope({
    ...scope,
    included_device_ids: allEligible ? [] : selected,
  })
  const previewInput = {
    release_family_id: releaseId,
    scope: targetScope,
    activation_policy: policy,
    scheduled_for:
      policy === 'scheduled' && scheduledFor
        ? new Date(scheduledFor).toISOString()
        : null,
    mandatory: policy !== 'download_only',
  }
  const fingerprint = managedUpdateIntentFingerprint(previewInput)
  useEffect(() => {
    setPreview(null)
    setConfirmed(false)
    resetDeploymentRequestId(requestIdRef)
  }, [fingerprint])
  useEffect(() => {
    setSelected([])
    setAllEligible(true)
  }, [
    releaseId,
    scope.restaurant_ids.join(','),
    scope.reseller_group_ids.join(','),
  ])

  const previewMutation = useMutation({
    mutationFn: () => previewManagedUpdateRollout(restaurantId, previewInput),
    onSuccess: (result) => {
      setChanges(previewChanges(previousPreviewRef.current, result))
      previousPreviewRef.current = result
      setPreview(result)
      setConfirmed(false)
    },
  })
  const createMutation = useMutation({
    mutationFn: () => {
      const intent = {
        ...previewInput,
        preview_token: preview.preview_token,
        reason: reason.trim(),
      }
      return createManagedUpdateRollout(restaurantId, {
        ...intent,
        request_id: requestIdForDeploymentIntent(requestIdRef, intent),
      })
    },
    onSuccess: (rollout) => {
      resetDeploymentRequestId(requestIdRef)
      onCreated(rollout)
    },
    onError: (error) => {
      if (managedUpdateErrorCode(error) === 'PREVIEW_STALE') setPreview(null)
    },
  })
  const toggleDevice = (device) => {
    if (!device.eligible) return
    if (allEligible) {
      setAllEligible(false)
      setSelected(eligibleIds.filter((id) => id !== device.id))
      return
    }
    setSelected((current) =>
      current.includes(device.id)
        ? current.filter((id) => id !== device.id)
        : [...current, device.id],
    )
  }
  const hasPreviewScope = allEligible ? devices.length > 0 : selected.length > 0
  const canPreview =
    releaseId && hasPreviewScope && (policy !== 'scheduled' || scheduledFor)
  const canCreate =
    preview &&
    preview.eligible_count > 0 &&
    confirmed &&
    reason.trim().length >= 3
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-dash-cream">
            Compose staged rollout
          </h2>
          <p className="mt-1 text-sm text-dash-secondary">
            Scope → approved release → policy → authoritative preview → reasoned
            confirmation.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {scopePicker.node}
          <label className="block">
            <span className="text-xs font-semibold text-dash-secondary">
              Approved release family
            </span>
            <select
              value={releaseId}
              onChange={(e) => setReleaseId(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose an OTA release…</option>
              {deployable.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.version_label} · {release.artifacts?.length || 0}{' '}
                  platform artifacts
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs text-dash-tertiary">
              Revoked, draft, native-only, and legacy artifacts without an
              immutable source group are never selectable.
            </span>
          </label>
          <fieldset>
            <legend className="text-xs font-semibold text-dash-secondary">
              Activation policy
            </legend>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {ACTIVATION_POLICIES.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${policy === option.id ? 'border-dash-gold/60 bg-dash-gold/5' : 'border-dash-border'}`}
                >
                  <input
                    type="radio"
                    name="managed-update-policy"
                    checked={policy === option.id}
                    onChange={() => setPolicy(option.id)}
                    className="mt-1 accent-[#d4a854]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-dash-cream">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-dash-secondary">
                      {option.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {policy === 'scheduled' ? (
            <label className="block">
              <span className="text-xs font-semibold text-dash-secondary">
                Eligible at
              </span>
              <input
                type="datetime-local"
                value={scheduledFor}
                min={formatLocalDateTimeInput(Date.now() + 60_000)}
                onChange={(e) => setScheduledFor(e.target.value)}
                className={inputClass}
              />
            </label>
          ) : null}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-dash-secondary">
                  Exact devices
                </p>
                <p className="mt-1 text-xs text-dash-tertiary">
                  “Select all eligible” applies only to this authorized
                  store/group scope. Exclusions remain visible with server
                  reason codes.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAllEligible(true)
                  setSelected([])
                }}
              >
                Select all eligible ({eligibleIds.length})
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-dash-border">
              {fleetQuery.isLoading ? (
                <p className="p-5 text-sm text-dash-secondary">
                  Resolving device compatibility…
                </p>
              ) : null}
              {fleetQuery.error ? (
                <p role="alert" className="p-5 text-sm text-red-300">
                  {errorMessage(fleetQuery.error)}
                </p>
              ) : null}
              {!fleetQuery.isLoading && !fleetQuery.error ? (
                <FleetTable
                  devices={devices}
                  selectable
                  allEligible={allEligible}
                  selected={selected}
                  onToggle={toggleDevice}
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => previewMutation.mutate()}
              disabled={!canPreview || previewMutation.isPending}
              icon={<ShieldCheck size={15} />}
            >
              {previewMutation.isPending
                ? 'Refreshing preview…'
                : preview
                  ? 'Refresh preview'
                  : 'Preview rollout'}
            </Button>
            <span className="text-xs text-dash-tertiary">
              {selectionCount} eligible device{selectionCount === 1 ? '' : 's'}{' '}
              selected
            </span>
          </div>
          {previewMutation.error ? (
            <p role="alert" className="text-sm text-red-300">
              {errorMessage(previewMutation.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <PreviewPanel preview={preview} changes={changes} />
      {preview ? (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-dash-cream">
              Reasoned confirmation
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-dash-secondary">
                Operator reason
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className={inputClass}
                placeholder="Why is this exact release being rolled out to this scope?"
              />
            </label>
            <label className="flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 accent-[#d4a854]"
              />
              <span>
                I reviewed the exact devices, platform/runtime cohorts,
                exclusions, and four manual waves. Creating this rollout does
                not publish or command a terminal; delivery preparation is a
                separate explicit action.
              </span>
            </label>
            {createMutation.error ? (
              <p role="alert" className="text-sm text-red-300">
                {managedUpdateErrorCode(createMutation.error) ===
                'PREVIEW_STALE'
                  ? 'The preview became stale. Refresh it before creating the rollout.'
                  : errorMessage(createMutation.error)}
              </p>
            ) : null}
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canCreate || createMutation.isPending}
              icon={<Rocket size={15} />}
            >
              {createMutation.isPending
                ? 'Creating…'
                : 'Create rollout in preparing state'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function ActionDialog({ action, onClose, onConfirm, pending, error }) {
  const [reason, setReason] = useState('')
  const [deferredUntil, setDeferredUntil] = useState('')
  useEffect(() => {
    setReason('')
    setDeferredUntil('')
  }, [action?.requestId])
  const destructive = ['cancel', 'rollback', 'revoke'].includes(action?.action)
  const canConfirm =
    reason.trim().length >= 3 && (action?.action !== 'defer' || deferredUntil)
  if (!action) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-action-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-dash-border bg-dash-base p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="update-action-title"
              className="text-lg font-semibold text-dash-cream"
            >
              {action.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-dash-secondary">
              {action.detail}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="text-dash-secondary" size={20} />
          </button>
        </div>
        {action.warning ? (
          <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">
            {action.warning}
          </p>
        ) : null}
        {action.action === 'defer' ? (
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-dash-secondary">
              Deferred until
            </span>
            <input
              type="datetime-local"
              value={deferredUntil}
              min={formatLocalDateTimeInput(Date.now() + 60_000)}
              onChange={(e) => setDeferredUntil(e.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-dash-secondary">
            Required audit reason
          </span>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className={inputClass}
          />
        </label>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {errorMessage(error)}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={!canConfirm || pending}
            onClick={() => onConfirm({ reason: reason.trim(), deferredUntil })}
          >
            {pending ? 'Working…' : action.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RolloutDetail({ restaurantId, rolloutId, onChanged }) {
  const queryClient = useQueryClient()
  const [action, setAction] = useState(null)
  const openAction = (config) => {
    mutation.reset()
    setAction({ ...config, requestId: crypto.randomUUID() })
  }
  const query = useQuery({
    queryKey: ['device-updates-v2', 'rollout', restaurantId, rolloutId],
    queryFn: ({ signal }) =>
      fetchManagedUpdateRollout(restaurantId, rolloutId, signal),
    enabled: Boolean(rolloutId),
    staleTime: 10_000,
  })
  const mutation = useMutation({
    mutationFn: ({ config, reason, deferredUntil }) => {
      const input = { request_id: config.requestId, reason }
      if (config.action === 'defer')
        input.deferred_until = new Date(deferredUntil).toISOString()
      return config.targetId
        ? mutateManagedUpdateTarget(
            restaurantId,
            rolloutId,
            config.targetId,
            config.action,
            input,
          )
        : mutateManagedUpdateRollout(
            restaurantId,
            rolloutId,
            config.action,
            input,
          )
    },
    onSuccess: (result, variables) => {
      setAction(null)
      if (result?.id === rolloutId) {
        queryClient.setQueryData(
          ['device-updates-v2', 'rollout', restaurantId, rolloutId],
          result,
        )
      }
      onChanged(result, variables.config.action)
    },
  })
  if (!rolloutId)
    return (
      <Empty>
        Select a rollout to inspect its targets, exact identities, and audit
        history.
      </Empty>
    )
  if (query.isLoading)
    return <p className="text-sm text-dash-secondary">Loading rollout…</p>
  if (query.error)
    return (
      <p role="alert" className="text-sm text-red-300">
        {errorMessage(query.error)}
      </p>
    )
  const rollout = query.data
  const countStates = (...states) =>
    states.reduce(
      (total, state) => total + Number(rollout.state_counts?.[state] || 0),
      0,
    )
  const rolloutStats = [
    ['active', countStates('active')],
    [
      'waiting',
      countStates(
        'eligible',
        'released',
        'queued',
        'seen',
        'downloading',
        'downloaded',
        'waiting_close_day',
        'activating',
      ),
    ],
    ['blocked', countStates('waiting_safe_point')],
    ['failed', countStates('failed', 'incompatible', 'expired')],
    ['deferred', countStates('deferred')],
    ['cancelled', countStates('cancelled')],
  ]
  const controls = []
  if (rollout.status === 'preparing')
    controls.push({
      action: 'prepare-delivery',
      title: 'Prepare immutable delivery',
      confirmLabel: 'Dispatch preparation',
      detail:
        'Republish the approved source group into this rollout’s one-time channel.',
      warning:
        'This dispatches the GitHub workflow and publishes a new EAS update. Wave one is released only after the signed callback validates both platform artifacts.',
    })
  if (['preparing', 'ready', 'active'].includes(rollout.status))
    controls.push({
      action: 'pause',
      title: 'Pause rollout',
      confirmLabel: 'Pause',
      detail:
        'Prevent new waves from being released. Already-released safe activations may finish.',
    })
  if (rollout.status === 'paused')
    controls.push({
      action: 'resume',
      title: 'Resume rollout',
      confirmLabel: 'Resume',
      detail: 'Restore this rollout to its prior preparation or active state.',
    })
  if (
    ['ready', 'active'].includes(rollout.status) &&
    Number(rollout.current_wave) < 4
  )
    controls.push({
      action: 'advance',
      title: 'Advance rollout wave',
      confirmLabel: `Release wave ${Number(rollout.current_wave) + 1}`,
      detail:
        'Release the next wave manually. Any verified failure blocks advancement and pauses the rollout.',
    })
  if (['preparing', 'ready', 'active', 'paused'].includes(rollout.status))
    controls.push({
      action: 'cancel',
      title: 'Cancel rollout',
      confirmLabel: 'Cancel not-yet-active targets',
      detail:
        'Cancel commands that have not activated. Active devices remain on their current code and require rollback.',
      warning:
        'Cancellation never silently changes code that is already running.',
    })
  if (Number(rollout.state_counts?.active || 0) > 0)
    controls.push({
      action: 'rollback',
      title: 'Create LKG rollback rollout',
      confirmLabel: 'Create rollback',
      detail:
        'Create a new preparing rollout for the verified last-known-good release across active targets.',
      warning:
        'Rollback republishes historical code as a new immutable EAS delivery and still waits for terminal safety.',
    })
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-dash-cream">
                  {rollout.version_label}
                </h2>
                <Badge variant={toneForState(rollout.status)}>
                  {humanizeUpdateCode(rollout.status)}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-dash-tertiary">
                {rollout.id}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => query.refetch()}
              icon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
            <Stat label="Wave" value={`${rollout.current_wave}/4`} />
            {rolloutStats.map(([state, count]) => (
              <Stat
                key={state}
                label={humanizeUpdateCode(state)}
                value={count}
                tone={
                  state === 'failed' && count
                    ? 'text-red-300'
                    : 'text-dash-cream'
                }
              />
            ))}
          </div>
          {rollout.failure_code ? (
            <p className="rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-200">
              <strong>{humanizeUpdateCode(rollout.failure_code)}:</strong>{' '}
              {rollout.failure_detail || rollout.pause_reason}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {controls.map((control) => (
              <Button
                key={control.action}
                size="sm"
                variant={
                  ['cancel', 'rollback'].includes(control.action)
                    ? 'danger'
                    : 'secondary'
                }
                onClick={() => {
                  openAction(control)
                }}
                icon={
                  control.action === 'pause' ? (
                    <Pause size={14} />
                  ) : control.action === 'resume' ? (
                    <Play size={14} />
                  ) : control.action === 'advance' ? (
                    <SkipForward size={14} />
                  ) : control.action === 'rollback' ? (
                    <RotateCcw size={14} />
                  ) : null
                }
              >
                {control.confirmLabel}
              </Button>
            ))}
          </div>
          <dl className="grid gap-2 text-xs text-dash-secondary md:grid-cols-2">
            <div>
              <dt className="text-dash-tertiary">Source EAS group</dt>
              <dd className="break-all font-mono">
                {rollout.source_eas_group_id || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-dash-tertiary">Created</dt>
              <dd>
                {formatTime(rollout.created_at)} · {rollout.created_by_name}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-dash-cream">
            Immutable deliveries
          </h3>
        </CardHeader>
        <CardContent>
          {(rollout.deliveries || []).length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {rollout.deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="rounded-xl border border-dash-border p-4 text-sm"
                >
                  <p className="font-semibold text-dash-cream">
                    {delivery.platform.toUpperCase()} · runtime{' '}
                    {delivery.runtime_version}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-dash-secondary">
                    {delivery.delivery_channel}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-dash-tertiary">
                    {delivery.delivery_update_id}
                  </p>
                  <p className="mt-1 break-all text-xs text-dash-tertiary">
                    Group {delivery.delivery_eas_group_id}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Delivery is not prepared yet.</Empty>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-dash-cream">Target devices</h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-dash-border">
            {(rollout.targets || []).map((target) => {
              const state = effectiveTargetState(target)
              const retryable =
                ['failed', 'expired', 'deferred'].includes(target.state) &&
                Number(target.attempt_count || 0) < 3
              const cancellable = ![
                'active',
                'activating',
                'cancelled',
              ].includes(state)
              const deferrable =
                cancellable && !['failed', 'incompatible'].includes(state)
              return (
                <div
                  key={target.id}
                  className="grid gap-3 p-5 xl:grid-cols-[1.1fr_.6fr_1.2fr_auto] xl:items-center"
                >
                  <div>
                    <p className="font-semibold text-dash-cream">
                      {target.device_name}
                    </p>
                    <p className="mt-1 text-xs text-dash-tertiary">
                      {target.restaurant_name} · {target.platform} · runtime{' '}
                      {target.runtime_version} · wave {target.wave_number}
                    </p>
                  </div>
                  <div>
                    <Badge variant={toneForState(state)}>
                      {humanizeUpdateCode(state)}
                    </Badge>
                    <p className="mt-1 text-xs text-dash-tertiary">
                      Attempt {Number(target.attempt_count || 0) + 1}/3
                    </p>
                  </div>
                  <div className="text-xs text-dash-secondary">
                    <p className="break-all">
                      {state === 'active'
                        ? 'Running update ID:'
                        : 'Last acknowledged update ID:'}{' '}
                      <span className="font-mono">
                        {target.reported_update_id || 'not reported'}
                      </span>
                    </p>
                    <p className="mt-1">
                      Ack: {formatTime(target.last_ack_at)}
                    </p>
                    {target.blocker_code || target.error_code ? (
                      <p className="mt-1 text-amber-200">
                        {humanizeUpdateCode(
                          target.error_code || target.blocker_code,
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {retryable ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          openAction({
                            action: 'retry',
                            targetId: target.id,
                            title: `Retry ${target.device_name}`,
                            confirmLabel: 'Retry target',
                            detail:
                              'Retry this target with the same immutable delivery. Three attempts are allowed.',
                          })
                        }}
                      >
                        Retry
                      </Button>
                    ) : null}
                    {deferrable ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          openAction({
                            action: 'defer',
                            targetId: target.id,
                            title: `Defer ${target.device_name}`,
                            confirmLabel: 'Defer target',
                            detail:
                              'Cancel any waiting command and hold this target until a future time.',
                          })
                        }}
                      >
                        Defer
                      </Button>
                    ) : null}
                    {cancellable ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          openAction({
                            action: 'cancel',
                            targetId: target.id,
                            title: `Cancel ${target.device_name}`,
                            confirmLabel: 'Cancel target',
                            detail:
                              'Cancel this device before activation. Active code is never silently reverted.',
                          })
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-dash-cream">Rollout audit</h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-dash-border">
            {(rollout.audit || []).map((event) => (
              <div
                key={event.event_id}
                className="grid gap-2 p-4 md:grid-cols-[180px_1fr_220px]"
              >
                <p className="text-xs text-dash-tertiary">
                  {formatTime(event.created_at)}
                </p>
                <div>
                  <p className="text-sm font-semibold text-dash-cream">
                    {humanizeUpdateCode(event.event_type)}
                  </p>
                  <p className="mt-1 text-xs text-dash-secondary">
                    {event.reason || 'Recorded control-plane event'}
                  </p>
                </div>
                <p className="text-xs text-dash-secondary">
                  {event.actor_name} · {humanizeUpdateCode(event.actor_type)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <ActionDialog
        action={action}
        onClose={() => setAction(null)}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={({ reason, deferredUntil }) =>
          mutation.mutate({ config: action, reason, deferredUntil })
        }
      />
    </div>
  )
}

function RolloutsWorkspace({ restaurantId, scope, onSelect, selectedId }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['device-updates-v2', 'rollouts', scope],
    queryFn: ({ signal }) =>
      fetchManagedUpdateRollouts(restaurantId, scope, signal),
    enabled: Boolean(
      scope.restaurant_ids.length || scope.reseller_group_ids.length,
    ),
    staleTime: 15_000,
  })
  const rollouts = query.data?.items || []
  const visibleSelectedId = rollouts.some(
    (rollout) => rollout.id === selectedId,
  )
    ? selectedId
    : ''
  useEffect(() => {
    if (query.isLoading) return
    const nextId = visibleSelectedId || rollouts[0]?.id || ''
    if (nextId !== selectedId) onSelect(nextId)
  }, [onSelect, query.isLoading, rollouts, selectedId, visibleSelectedId])
  const changed = (result, action) => {
    queryClient.invalidateQueries({ queryKey: ['device-updates-v2'] })
    if (action === 'rollback' && result?.id && result.id !== selectedId)
      onSelect(result.id)
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="self-start">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-dash-cream">Rollouts</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => query.refetch()}
              icon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <p className="p-5 text-sm text-dash-secondary">Loading rollouts…</p>
          ) : null}
          {query.error ? (
            <p role="alert" className="p-5 text-sm text-red-300">
              {errorMessage(query.error)}
            </p>
          ) : null}
          {!query.isLoading && !query.error && !rollouts.length ? (
            <div className="p-4">
              <Empty>No V2 rollouts in this scope.</Empty>
            </div>
          ) : null}
          <div className="divide-y divide-dash-border">
            {rollouts.map((rollout) => (
              <button
                key={rollout.id}
                type="button"
                onClick={() => onSelect(rollout.id)}
                className={`w-full p-4 text-left ${visibleSelectedId === rollout.id ? 'bg-dash-gold/10' : 'hover:bg-white/[0.03]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-dash-cream">
                    {rollout.version_label}
                  </p>
                  <ChevronRight size={15} className="text-dash-tertiary" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={toneForState(rollout.status)}>
                    {humanizeUpdateCode(rollout.status)}
                  </Badge>
                  <span className="text-xs text-dash-tertiary">
                    wave {rollout.current_wave}/4
                  </span>
                </div>
                <p className="mt-2 text-xs text-dash-secondary">
                  {rollout.active_count}/{rollout.target_count} active ·{' '}
                  {rollout.failed_count} failed
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <RolloutDetail
        restaurantId={restaurantId}
        rolloutId={visibleSelectedId}
        onChanged={changed}
      />
    </div>
  )
}

function ReleasesWorkspace({ restaurantId, releases, isAdmin, onChanged }) {
  const [action, setAction] = useState(null)
  const [verifiedCommandId, setVerifiedCommandId] = useState('')
  const openAction = (config) => {
    mutation.reset()
    setVerifiedCommandId('')
    setAction({ ...config, requestId: crypto.randomUUID() })
  }
  const mutation = useMutation({
    mutationFn: ({ config, reason }) => {
      const input = { request_id: config.requestId, reason }
      if (config.action === 'last-known-good') {
        input.platform = config.artifact.platform
        input.runtime_version = config.artifact.runtime_version
        input.verified_command_id = verifiedCommandId.trim()
      }
      return mutateManagedUpdateRelease(
        restaurantId,
        config.release.id,
        config.action,
        input,
      )
    },
    onSuccess: () => {
      setAction(null)
      setVerifiedCommandId('')
      onChanged()
    },
  })
  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <Library className="mt-0.5 text-dash-gold" size={22} />
            <div>
              <h2 className="font-semibold text-dash-cream">
                Immutable release families
              </h2>
              <p className="mt-1 text-sm leading-6 text-dash-secondary">
                The pinned source workflow imports Android and iOS artifacts as
                a draft. Platform admins approve, revoke, and mark
                last-known-good only after exact activation proof. Native
                binaries remain catalog-only and require a managed
                installer/MDM.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {releases.map((release) => {
          const isNative = (release.artifacts || []).some(
            (artifact) => artifact.artifact_kind === 'native',
          )
          return (
            <Card key={release.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-dash-cream">
                      {release.version_label}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-dash-tertiary">
                      Git {release.git_commit || 'unknown'} · source{' '}
                      {release.source_eas_group_id || 'legacy'}
                    </p>
                  </div>
                  <Badge variant={toneForState(release.status)}>
                    {release.status}
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {(release.artifacts || []).map((artifact) => {
                    const lkg = (release.last_known_good || []).find(
                      (pointer) =>
                        pointer.platform === artifact.platform &&
                        pointer.runtime_version === artifact.runtime_version,
                    )
                    return (
                      <div
                        key={artifact.id}
                        className="rounded-xl border border-dash-border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-dash-cream">
                            {artifact.platform.toUpperCase()} ·{' '}
                            {artifact.artifact_kind.toUpperCase()}
                          </p>
                          {lkg ? (
                            <Badge variant="success">Verified LKG</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-dash-secondary">
                          Runtime{' '}
                          <span className="font-mono">
                            {artifact.runtime_version || 'native baseline'}
                          </span>
                        </p>
                        <p className="mt-1 break-all font-mono text-[11px] text-dash-tertiary">
                          {artifact.expo_update_id ||
                            `${artifact.native_version || 'unknown'} (${artifact.native_build || 'unknown'})`}
                        </p>
                        {isAdmin &&
                        release.status === 'approved' &&
                        artifact.artifact_kind === 'ota' &&
                        !lkg ? (
                          <Button
                            className="mt-3"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              openAction({
                                action: 'last-known-good',
                                release,
                                artifact,
                                title: `Mark ${artifact.platform.toUpperCase()} runtime ${artifact.runtime_version} LKG`,
                                confirmLabel: 'Verify LKG',
                                detail:
                                  'Provide a command that proves this exact artifact restarted successfully on a real device.',
                              })
                            }}
                          >
                            Mark LKG
                          </Button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                {isNative ? (
                  <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">
                    Managed installer/MDM required. This release has no OTA
                    rollout action.
                  </p>
                ) : null}
                {release.release_notes ? (
                  <p className="mt-4 text-sm text-dash-secondary">
                    {release.release_notes}
                  </p>
                ) : null}
                {isAdmin ? (
                  <div className="mt-4 flex gap-2">
                    {release.status === 'draft' ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          openAction({
                            action: 'approve',
                            release,
                            title: `Approve ${release.version_label}`,
                            confirmLabel: 'Approve release',
                            detail:
                              'Approve this immutable source family for authorized rollout selection.',
                          })
                        }}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {release.status === 'approved' ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          openAction({
                            action: 'revoke',
                            release,
                            title: `Revoke ${release.version_label}`,
                            confirmLabel: 'Revoke release',
                            detail:
                              'Prevent new rollouts and resume operations from using this release. Existing active code is not silently removed.',
                          })
                        }}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
      {!releases.length ? (
        <Empty>No release families are visible.</Empty>
      ) : null}
      {action ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-dash-border bg-dash-base p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-dash-cream">
                  {action.title}
                </h2>
                <p className="mt-2 text-sm text-dash-secondary">
                  {action.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAction(null)
                  setVerifiedCommandId('')
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {action.action === 'last-known-good' ? (
              <label className="mt-4 block">
                <span className="text-xs text-dash-secondary">
                  Verified active command ID
                </span>
                <input
                  value={verifiedCommandId}
                  onChange={(e) => setVerifiedCommandId(e.target.value)}
                  className={inputClass}
                  placeholder="UUID from exact successful activation"
                />
              </label>
            ) : null}
            <ReleaseReason
              mutation={mutation}
              action={action}
              verifiedCommandId={verifiedCommandId}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ReleaseReason({ mutation, action, verifiedCommandId }) {
  const [reason, setReason] = useState('')
  const valid =
    reason.trim().length >= 3 &&
    (action.action !== 'last-known-good' || verifiedCommandId.trim())
  return (
    <>
      <label className="mt-4 block">
        <span className="text-xs text-dash-secondary">
          Required audit reason
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          className={inputClass}
        />
      </label>
      {mutation.error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {errorMessage(mutation.error)}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button
          variant={action.action === 'revoke' ? 'danger' : 'primary'}
          disabled={!valid || mutation.isPending}
          onClick={() =>
            mutation.mutate({ config: action, reason: reason.trim() })
          }
        >
          {mutation.isPending ? 'Working…' : action.confirmLabel}
        </Button>
      </div>
    </>
  )
}

function PolicyWorkspace({ restaurantId }) {
  const queryClient = useQueryClient()
  const overview = useQuery({
    queryKey: ['device-updates', restaurantId, 'overview'],
    queryFn: ({ signal }) => fetchDeviceUpdateOverview(restaurantId, signal),
    staleTime: 30_000,
  })
  const [policy, setPolicy] = useState('after_close_day')
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (overview.data?.policy?.default_activation_policy)
      setPolicy(overview.data.policy.default_activation_policy)
  }, [overview.data?.policy?.default_activation_policy])
  const mutation = useMutation({
    mutationFn: () =>
      saveDeviceUpdatePolicy(restaurantId, {
        default_activation_policy: policy,
        close_day_delay_minutes: 60,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setReason('')
      queryClient.invalidateQueries({
        queryKey: ['device-updates', restaurantId],
      })
    },
  })
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-dash-cream">
          Store default activation policy
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <select
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
          className={inputClass}
        >
          {ACTIVATION_POLICIES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="rounded-xl border border-dash-gold/20 bg-dash-gold/5 p-4 text-sm text-dash-secondary">
          Close Day delay remains fixed at 60 minutes. Clock-out state is not
          consulted, and this preference never bypasses terminal safety.
        </p>
        <label className="block">
          <span className="text-xs font-semibold text-dash-secondary">
            Required audit reason
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            className={inputClass}
            placeholder="Why should this store default change?"
          />
        </label>
        {mutation.error ? (
          <p role="alert" className="text-sm text-red-300">
            {errorMessage(mutation.error)}
          </p>
        ) : null}
        <Button
          onClick={() => mutation.mutate()}
          disabled={reason.trim().length < 3 || mutation.isPending}
        >
          {mutation.isPending ? 'Saving…' : 'Save default'}
        </Button>
      </CardContent>
    </Card>
  )
}

function LegacyAudit({ restaurantId }) {
  const query = useQuery({
    queryKey: ['device-updates', restaurantId, 'audit'],
    queryFn: ({ signal }) => fetchDeviceUpdateAudit(restaurantId, signal),
    staleTime: 30_000,
  })
  if (query.isLoading)
    return (
      <p className="text-sm text-dash-secondary">
        Loading V1 compatibility audit…
      </p>
    )
  if (query.error)
    return (
      <p role="alert" className="text-sm text-red-300">
        {errorMessage(query.error)}
      </p>
    )
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-dash-cream">
          V1 compatibility audit
        </h2>
        <p className="mt-1 text-sm text-dash-secondary">
          Retained during the Protocol V2 bootstrap window.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-dash-border">
          {(query.data?.items || []).map((item) => (
            <div
              key={item.id}
              className="grid gap-2 p-5 md:grid-cols-[180px_1fr_220px]"
            >
              <p className="text-xs text-dash-tertiary">
                {formatTime(item.created_at)}
              </p>
              <div>
                <p className="font-semibold text-dash-cream">
                  {humanizeUpdateCode(item.event_type)}
                </p>
                <p className="mt-1 text-xs text-dash-secondary">
                  {item.reason || 'Recorded event'}
                </p>
              </div>
              <p className="text-xs text-dash-secondary">{item.actor_name}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DeviceUpdatesPage({ restaurantId }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('fleet')
  const [scopeMode, setScopeMode] = useState('store')
  const [groupId, setGroupId] = useState('')
  const [selectedRolloutId, setSelectedRolloutId] = useState('')
  const portfolioQuery = useQuery({
    queryKey: [
      'managed-update-portfolio',
      auth.user?.id,
      auth.accountType,
      auth.restaurant.restaurants,
    ],
    queryFn: () =>
      fetchResellerPortfolioForUser({
        userId: auth.user.id,
        accountType: auth.accountType,
        restaurants: auth.restaurant.restaurants,
      }),
    enabled: Boolean(
      auth.user?.id &&
      ['reseller', 'reseller_employee', 'admin'].includes(auth.accountType),
    ),
    staleTime: 60_000,
  })
  const groups = useMemo(() => {
    const all = portfolioQuery.data?.groups || []
    if (auth.accountType !== 'reseller_employee') return all
    const allowed = new Set(portfolioQuery.data?.employee?.group_ids || [])
    return all.filter((group) => allowed.has(group.id))
  }, [auth.accountType, portfolioQuery.data])
  useEffect(() => {
    if (
      scopeMode === 'group' &&
      !groups.some((group) => group.id === groupId)
    ) {
      setGroupId(groups[0]?.id || '')
    }
  }, [groupId, groups, scopeMode])
  const scope = useMemo(
    () =>
      normalizeRolloutScope(
        scopeMode === 'group'
          ? { reseller_group_ids: groupId ? [groupId] : [] }
          : { restaurant_ids: [restaurantId] },
      ),
    [groupId, restaurantId, scopeMode],
  )
  const releasesQuery = useQuery({
    queryKey: ['device-updates-v2', 'releases', restaurantId, auth.accountType],
    queryFn: ({ signal }) =>
      fetchManagedUpdateReleases(
        restaurantId,
        { includeDrafts: auth.accountType === 'admin' },
        signal,
      ),
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  })
  const releases = releasesQuery.data?.items || []
  const scopeNode = (
    <ScopePicker
      restaurantId={restaurantId}
      groups={groups}
      scopeMode={scopeMode}
      groupId={groupId}
      onScopeMode={(value) => {
        setScopeMode(value)
        setSelectedRolloutId('')
      }}
      onGroupId={(value) => {
        setGroupId(value)
        setSelectedRolloutId('')
      }}
    />
  )
  const scopePicker = { restaurantId, node: scopeNode }
  const refreshAll = () =>
    queryClient.invalidateQueries({ queryKey: ['device-updates-v2'] })
  const onCreated = (rollout) => {
    setSelectedRolloutId(rollout.id)
    setActiveTab('rollouts')
    refreshAll()
  }
  if (releasesQuery.isLoading)
    return (
      <div className="flex min-h-52 items-center justify-center">
        <RefreshCw className="animate-spin text-dash-gold" />
      </div>
    )
  if (releasesQuery.error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300/20 bg-red-300/5 p-5 text-red-200"
      >
        <div className="flex items-center gap-2 font-semibold">
          <XCircle size={18} />
          Managed updates unavailable
        </div>
        <p className="mt-2 text-sm">{errorMessage(releasesQuery.error)}</p>
        <Button className="mt-4" onClick={() => releasesQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  const approved = releases.filter(isOtaDeployableRelease).length
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-dash-border bg-gradient-to-br from-white/[0.045] to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Download className="text-dash-gold" size={21} />
              <h1 className="text-xl font-semibold text-dash-cream">
                Managed POS Updates V2
              </h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-dash-secondary">
              Exact Android and iOS OTA release control with authorized fleet
              scopes, immutable delivery channels, manual waves, automatic
              failure pauses, and verified LKG rollback.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={approved ? 'success' : 'warning'}>
              {approved} deployable release{approved === 1 ? '' : 's'}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshAll}
              icon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Creating a rollout is dark preparation. “Prepare immutable delivery”
            is the separate action that republishes through EAS; a signed
            callback must validate both platform artifacts before wave one
            commands exist.
          </p>
        </div>
      </section>
      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border border-dash-border bg-white/[0.025] p-1"
        aria-label="Managed update sections"
      >
        {PAGE_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold ${activeTab === tab.id ? 'bg-dash-gold/10 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'}`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </nav>
      {activeTab === 'fleet' ? (
        <FleetWorkspace
          scope={scope}
          scopePicker={scopePicker}
          releases={releases.filter((release) => release.status === 'approved')}
        />
      ) : null}
      {activeTab === 'compose' ? (
        <RolloutComposer
          restaurantId={restaurantId}
          scope={scope}
          scopePicker={scopePicker}
          releases={releases}
          onCreated={onCreated}
        />
      ) : null}
      {activeTab === 'rollouts' ? (
        <>
          <Card>
            <CardContent>{scopeNode}</CardContent>
          </Card>
          <RolloutsWorkspace
            restaurantId={restaurantId}
            scope={scope}
            selectedId={selectedRolloutId}
            onSelect={setSelectedRolloutId}
          />
        </>
      ) : null}
      {activeTab === 'releases' ? (
        <ReleasesWorkspace
          restaurantId={restaurantId}
          releases={releases}
          isAdmin={auth.accountType === 'admin'}
          onChanged={() => releasesQuery.refetch()}
        />
      ) : null}
      {activeTab === 'policy' ? (
        <PolicyWorkspace restaurantId={restaurantId} />
      ) : null}
      {activeTab === 'audit' ? (
        <LegacyAudit restaurantId={restaurantId} />
      ) : null}
    </div>
  )
}
