import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  PhoneCall,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { fetchReservationsApi } from '../../shared/api/reservationsClient'
import { queryClient, queryKeys, STALE_TIMES } from '../../shared/query'
import { Badge } from '../components/shared/Badge'
import { Button } from '../components/shared/Button'
import { Modal, ModalFooter } from '../components/shared/Modal'

const FORWARDING_OPTIONS = [
  {
    id: 'none',
    label: 'Use the new AI number',
    description: 'Publish the new number directly. Your current restaurant line is unchanged.',
  },
  {
    id: 'all_calls',
    label: 'Forward every call',
    description: 'Your carrier sends all calls from the existing restaurant line to the AI number.',
  },
  {
    id: 'unanswered_busy',
    label: 'Forward missed calls',
    description: 'Your team answers first; your carrier forwards busy or unanswered calls to the AI.',
  },
]

const STATUS_META = {
  not_started: ['Not started', 'neutral'],
  number_selection: ['Choose number', 'neutral'],
  purchase_pending: ['Ready to purchase', 'gold'],
  purchasing: ['Purchasing', 'warning'],
  assistant_provisioning: ['Configuring AI', 'warning'],
  forwarding_setup: ['Set up forwarding', 'warning'],
  verification_pending: ['Waiting for test call', 'warning'],
  active: ['Active', 'success'],
  action_required: ['Action required', 'danger'],
  failed: ['Setup failed', 'danger'],
  deactivated: ['Deactivated', 'neutral'],
  releasing: ['Releasing number', 'warning'],
  release_failed: ['Release needs attention', 'danger'],
  released: ['Number released', 'neutral'],
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (national.length !== 10) return value || 'Not assigned'
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
}

function nationalPhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

function StatusBadge({ status }) {
  const [label, variant] = STATUS_META[status] || [String(status || 'Unknown').replace(/_/g, ' '), 'neutral']
  return <Badge variant={variant} dot>{label}</Badge>
}

function TextField({ label, hint, ...props }) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="label-mono block">{label}</span>
      <input
        {...props}
        className="min-h-11 w-full rounded-lg border border-dash-border bg-[var(--glass-bg)] px-3.5 text-sm text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-shell-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {hint && <span className="block text-xs leading-5 text-dash-tertiary">{hint}</span>}
    </label>
  )
}

function SetupProgress({ setup }) {
  const hasNumber = Boolean(setup?.selectedPhoneNumber || setup?.voiceAgent?.phoneNumber)
  const provisioned = Boolean(setup?.voiceAgent?.vapiPhoneNumberId)
  const forwardingDone = setup?.forwardingMode === 'none' || setup?.verificationStatus === 'verified'
  const steps = [
    ['Number selected', hasNumber],
    ['AI line configured', provisioned],
    ['Forwarding ready', forwardingDone && provisioned],
  ]
  return (
    <ol className="grid gap-px overflow-hidden rounded-lg border border-dash-border bg-dash-border md:grid-cols-3">
      {steps.map(([label, complete], index) => (
        <li key={label} className="flex min-h-14 items-center gap-3 bg-dash-base px-4 py-3">
          {complete
            ? <CheckCircle2 size={18} className="shrink-0 text-dash-success" aria-hidden="true" />
            : <Circle size={18} className="shrink-0 text-dash-tertiary" aria-hidden="true" />}
          <span className={complete ? 'text-sm font-medium text-dash-cream' : 'text-sm text-dash-secondary'}>
            {index + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function ErrorNotice({ error }) {
  if (!error) return null
  const isBilling = error.code === 'TWILIO_ACCOUNT_UPGRADE_REQUIRED'
  const isRelease = error.code === 'NUMBER_RELEASE_FAILED'
  return (
    <div className="flex gap-3 border-y border-dash-danger/40 bg-dash-danger/10 px-4 py-3 text-sm text-dash-danger">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">
          {isBilling ? 'Platform billing action required' : isRelease ? 'Number release needs attention' : 'Could not complete that action'}
        </p>
        <p className="mt-1 leading-6">{error.message}</p>
      </div>
    </div>
  )
}

export default function VoiceReservationsPage({ restaurantId, readOnly = false }) {
  const [searchMode, setSearchMode] = useState('zip')
  const [searchValue, setSearchValue] = useState('')
  const [numbers, setNumbers] = useState([])
  const [searching, setSearching] = useState(false)
  const [busyAction, setBusyAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState('')
  const [forwardingMode, setForwardingMode] = useState('none')
  const [forwardingFrom, setForwardingFrom] = useState('')
  const [transferPhone, setTransferPhone] = useState('')
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [purchaseConfirmed, setPurchaseConfirmed] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseConfirmation, setReleaseConfirmation] = useState('')
  const requestContextRef = useRef({ restaurantId, generation: 0 })
  if (requestContextRef.current.restaurantId !== restaurantId) {
    requestContextRef.current = {
      restaurantId,
      generation: requestContextRef.current.generation + 1,
    }
  }
  const captureRequestContext = () => ({ ...requestContextRef.current })
  const requestIsCurrent = (request) => (
    request.restaurantId === requestContextRef.current.restaurantId
    && request.generation === requestContextRef.current.generation
  )

  const setupQuery = useQuery({
    queryKey: queryKeys.voiceProvisioning(restaurantId),
    queryFn: () => fetchReservationsApi(`/locations/${restaurantId}/voice-provisioning`),
    enabled: Boolean(restaurantId),
    staleTime: STALE_TIMES.setup,
    retry: false,
  })
  const setup = setupQuery.data
  const releasePending = ['releasing', 'release_failed'].includes(setup?.status)
  const provisioned = Boolean(
    setup?.voiceAgent?.vapiPhoneNumberId
    || setup?.voiceAgent?.twilioPhoneNumberSid
    || setup?.voiceAgent?.phoneNumber,
  )
  const managedReleaseAvailable = Boolean(setup?.voiceAgent?.twilioPhoneNumberSid || releasePending)
  const selectedNumber = setup?.selectedPhoneNumber || setup?.voiceAgent?.phoneNumber || ''

  useEffect(() => {
    setSearchMode('zip')
    setSearchValue('')
    setNumbers([])
    setSearching(false)
    setBusyAction(null)
    setActionError(null)
    setNotice('')
    setForwardingMode('none')
    setForwardingFrom('')
    setTransferPhone('')
    setPurchaseOpen(false)
    setPurchaseConfirmed(false)
    setReleaseOpen(false)
    setReleaseConfirmation('')
  }, [restaurantId])

  useEffect(() => {
    if (!setup) return
    const request = captureRequestContext()
    if (!requestIsCurrent(request) || request.restaurantId !== restaurantId) return
    setForwardingMode(setup.forwardingMode || 'none')
    setForwardingFrom(setup.forwardingFrom || '')
    setTransferPhone(setup.voiceAgent?.transferPhone || '')
  }, [restaurantId, setup?.id, setup?.updatedAt])

  const requirements = useMemo(
    () => (setup?.requirements || []).filter((item) => !['approved', 'waived'].includes(item.status)),
    [setup?.requirements],
  )

  const storeSetup = (next, request) => {
    if (!requestIsCurrent(request)) return undefined
    queryClient.setQueryData(queryKeys.voiceProvisioning(request.restaurantId), next)
    return next
  }

  const runSetupAction = async (name, endpoint, options = {}, successMessage = '') => {
    const request = captureRequestContext()
    setBusyAction(name)
    setActionError(null)
    setNotice('')
    try {
      const next = await fetchReservationsApi(`/locations/${request.restaurantId}/voice-provisioning${endpoint}`, options)
      if (!requestIsCurrent(request)) return undefined
      storeSetup(next, request)
      if (successMessage) setNotice(successMessage)
      return next
    } catch (error) {
      if (requestIsCurrent(request)) setActionError(error)
      throw error
    } finally {
      if (requestIsCurrent(request)) setBusyAction(null)
    }
  }

  const searchNumbers = async () => {
    const request = captureRequestContext()
    setSearching(true)
    setActionError(null)
    setNotice('')
    try {
      const payload = searchMode === 'area'
        ? { areaCode: searchValue }
        : { postalCode: searchValue }
      const result = await fetchReservationsApi(`/locations/${request.restaurantId}/voice-provisioning/available-numbers`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!requestIsCurrent(request)) return
      setNumbers(result.numbers || [])
      if (!(result.numbers || []).length) setNotice('No local voice numbers matched. Try a nearby ZIP or area code.')
    } catch (error) {
      if (requestIsCurrent(request)) {
        setNumbers([])
        setActionError(error)
      }
    } finally {
      if (requestIsCurrent(request)) setSearching(false)
    }
  }

  const selectNumber = async (number) => {
    try {
      await runSetupAction('select', '/number-selection', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: number.phoneNumber,
          areaCode: searchMode === 'area' ? searchValue : null,
          postalCode: searchMode === 'zip' ? searchValue : null,
          numberMetadata: number,
        }),
      }, `${formatPhone(number.phoneNumber)} selected.`)
    } catch {
      // The shared action notice already contains the provider/API error.
    }
  }

  const configurationPayload = () => ({
    forwardingMode,
    forwardingFrom: forwardingMode === 'none' ? null : forwardingFrom,
    transferPhone: transferPhone || null,
  })

  const saveConfiguration = async () => {
    try {
      await runSetupAction('configuration', '/configuration', {
        method: 'PUT',
        body: JSON.stringify(configurationPayload()),
      }, 'Call routing saved.')
    } catch {
      // The shared action notice already contains the provider/API error.
    }
  }

  const purchase = async () => {
    const request = captureRequestContext()
    const payload = configurationPayload()
    setBusyAction('purchase')
    setActionError(null)
    setNotice('')
    try {
      await fetchReservationsApi(`/locations/${request.restaurantId}/voice-provisioning/configuration`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!requestIsCurrent(request)) return
      const next = await fetchReservationsApi(`/locations/${request.restaurantId}/voice-provisioning/provision`, {
        method: 'POST',
        body: JSON.stringify({ confirmPurchase: true }),
      })
      if (!requestIsCurrent(request)) return
      storeSetup(next, request)
      setPurchaseOpen(false)
      setPurchaseConfirmed(false)
      setNotice('The AI number is configured. Complete forwarding below if you selected it.')
    } catch (error) {
      if (requestIsCurrent(request)) {
        setActionError(error)
        setPurchaseOpen(false)
      }
    } finally {
      if (requestIsCurrent(request)) setBusyAction(null)
    }
  }

  const startVerification = async () => {
    try {
      await runSetupAction('verification', '/forwarding-verification', { method: 'POST' }, 'Verification is listening for an inbound call for 15 minutes.')
    } catch {
      // The shared action notice already contains the provider/API error.
    }
  }

  const setEnabled = async (enabled) => {
    try {
      await runSetupAction('activation', '/activation', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }, enabled ? 'AI phone activated.' : 'AI phone deactivated.')
    } catch {
      // The shared action notice already contains the provider/API error.
    }
  }

  const releaseNumber = async () => {
    try {
      await runSetupAction('release', '/number', {
        method: 'DELETE',
        body: JSON.stringify({
          confirmRelease: true,
          phoneNumber: releaseConfirmation,
        }),
      }, 'The phone number was permanently released. Future Twilio monthly renewals have stopped.')
      setReleaseOpen(false)
      setReleaseConfirmation('')
    } catch {
      // The shared action notice already contains the provider/API error.
    }
  }

  const copyNumber = async () => {
    const request = captureRequestContext()
    const phoneNumber = selectedNumber
    if (!phoneNumber) return
    await navigator.clipboard.writeText(phoneNumber)
    if (requestIsCurrent(request)) setNotice('AI number copied.')
  }

  if (setupQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center" aria-label="Loading AI phone setup">
        <Loader2 size={24} className="animate-spin text-shell-accent" aria-hidden="true" />
      </div>
    )
  }

  if (setupQuery.error) {
    return (
      <div className="border-y border-dash-danger/40 py-8 text-center">
        <AlertTriangle size={22} className="mx-auto text-dash-danger" aria-hidden="true" />
        <p className="mt-3 text-sm text-dash-secondary">{setupQuery.error.message}</p>
        <Button className="mt-4" variant="outline" size="sm" icon={<RefreshCw size={15} />} onClick={() => setupQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-dash-border pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="label-mono">AI reservations line</p>
          <h2 className="mt-2 text-2xl font-semibold text-dash-cream">Phone setup</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-dash-secondary">
            Give guests a new reservation number or forward calls from your existing restaurant line.
          </p>
        </div>
        <StatusBadge status={setup?.status} />
      </header>

      <SetupProgress setup={setup} />
      <ErrorNotice error={actionError || (setup?.lastError ? { ...setup.lastError } : null)} />
      {requirements.map((requirement) => (
        <div key={requirement.id} className="flex gap-3 border-y border-dash-warning/40 bg-dash-warning/10 px-4 py-3 text-sm text-dash-warning">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{requirement.title}</p>
            {requirement.description && <p className="mt-1 leading-6">{requirement.description}</p>}
          </div>
        </div>
      ))}
      {notice && (
        <div className="flex items-center gap-2 border-y border-dash-success/30 bg-dash-success/10 px-4 py-3 text-sm text-dash-success">
          <Check size={17} aria-hidden="true" />
          {notice}
        </div>
      )}

      {provisioned ? (
        <section className="border-b border-dash-border pb-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),auto] lg:items-center">
            <div>
              <p className="label-mono">AI phone number</p>
              <p className="mt-2 text-3xl font-semibold text-dash-cream">{formatPhone(selectedNumber)}</p>
              <p className="mt-2 text-sm text-dash-secondary">
                {releasePending
                  ? 'Permanent release needs to be retried before this phone setup can be used again.'
                  : 'Calls to this number are routed to this restaurant’s versioned Shire assistant.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={<Copy size={15} />} onClick={() => void copyNumber()}>
                Copy
              </Button>
              {setup.voiceAgent.phoneNumber && !releasePending && (
                <a
                  href={`tel:${setup.voiceAgent.phoneNumber}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-dash-gold px-3 py-1.5 text-sm font-medium text-dash-base transition hover:bg-dash-gold/90"
                >
                  <PhoneCall size={15} aria-hidden="true" />
                  Call
                </a>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4 border-b border-dash-border pb-6">
          <div>
            <h3 className="text-base font-semibold text-dash-cream">Choose a local number</h3>
            <p className="mt-1 text-sm text-dash-secondary">Search current Twilio inventory by restaurant ZIP or area code.</p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <div className="mb-2 inline-flex rounded-lg border border-dash-border p-1" role="group" aria-label="Number search type">
                {[
                  ['zip', 'ZIP code', MapPin],
                  ['area', 'Area code', Phone],
                ].map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setSearchMode(id); setSearchValue(''); setNumbers([]) }}
                    className={`inline-flex min-h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${searchMode === id ? 'bg-dash-cream/10 text-dash-cream' : 'text-dash-tertiary hover:text-dash-secondary'}`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
              <TextField
                label={searchMode === 'zip' ? 'Restaurant ZIP' : 'Preferred area code'}
                inputMode="numeric"
                value={searchValue}
                maxLength={searchMode === 'zip' ? 10 : 3}
                placeholder={searchMode === 'zip' ? '15222' : '412'}
                onChange={(event) => setSearchValue(event.target.value.replace(/[^0-9-]/g, ''))}
                disabled={readOnly || searching}
              />
            </div>
            <Button
              className="min-h-11"
              variant="secondary"
              icon={searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              disabled={readOnly || searching || !searchValue.trim()}
              onClick={() => void searchNumbers()}
            >
              Search numbers
            </Button>
          </div>

          {numbers.length > 0 && (
            <div className="divide-y divide-dash-border border-y border-dash-border">
              {numbers.map((number) => {
                const selected = selectedNumber === number.phoneNumber
                return (
                  <button
                    key={number.phoneNumber}
                    type="button"
                    onClick={() => void selectNumber(number)}
                    disabled={readOnly || busyAction === 'select'}
                    className="flex min-h-16 w-full items-center gap-3 px-3 text-left transition hover:bg-[var(--glass-bg-hover)] disabled:opacity-60"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-dash-success/50 bg-dash-success/10 text-dash-success' : 'border-dash-border text-dash-tertiary'}`}>
                      {selected ? <Check size={15} /> : <Phone size={14} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-dash-cream">{formatPhone(number.phoneNumber)}</span>
                      <span className="block truncate text-xs text-dash-tertiary">
                        {[number.locality, number.region, number.postalCode].filter(Boolean).join(', ') || 'US local number'}
                      </span>
                    </span>
                    <span className="ml-auto text-xs font-semibold text-shell-accent">{selected ? 'Selected' : 'Select'}</span>
                  </button>
                )
              })}
            </div>
          )}

          {selectedNumber && !numbers.some((number) => number.phoneNumber === selectedNumber) && (
            <div className="flex items-center gap-3 border-y border-dash-success/30 px-3 py-3">
              <CheckCircle2 size={18} className="text-dash-success" aria-hidden="true" />
              <span className="text-sm text-dash-secondary">Selected: <strong className="text-dash-cream">{formatPhone(selectedNumber)}</strong></span>
            </div>
          )}
        </section>
      )}

      <section className="space-y-5 border-b border-dash-border pb-6">
        <div>
          <h3 className="text-base font-semibold text-dash-cream">Call routing</h3>
          <p className="mt-1 text-sm text-dash-secondary">Choose how guests reach the AI and where it can transfer calls that need a person.</p>
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          {FORWARDING_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={readOnly}
              onClick={() => setForwardingMode(option.id)}
              className={`min-h-28 rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${forwardingMode === option.id ? 'border-shell-accent/60 bg-shell-accent/10' : 'border-dash-border hover:border-dash-tertiary'}`}
            >
              <span className="block text-sm font-semibold text-dash-cream">{option.label}</span>
              <span className="mt-2 block text-xs leading-5 text-dash-secondary">{option.description}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {forwardingMode !== 'none' && (
            <TextField
              label="Existing restaurant number"
              type="tel"
              value={forwardingFrom}
              placeholder="(412) 555-0100"
              onChange={(event) => setForwardingFrom(event.target.value)}
              disabled={readOnly}
              hint="Configure this number with your current phone carrier after the AI line is provisioned."
            />
          )}
          <TextField
            label="Human transfer number"
            type="tel"
            value={transferPhone}
            placeholder="Manager or host line"
            onChange={(event) => setTransferPhone(event.target.value)}
            disabled={readOnly}
            hint={forwardingMode === 'none' ? 'Optional number for callers who need your team.' : 'Must differ from the forwarded restaurant number to prevent a call loop.'}
          />
        </div>
        {!readOnly && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(busyAction)}
              icon={busyAction === 'configuration' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              onClick={() => void saveConfiguration()}
            >
              Save routing
            </Button>
          </div>
        )}
      </section>

      {!provisioned && selectedNumber && !readOnly && (
        <section className="flex flex-col gap-4 border-b border-dash-border pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-dash-cream">Provision {formatPhone(selectedNumber)}</h3>
            <p className="mt-1 text-sm text-dash-secondary">This purchases the number and creates the isolated Twilio and Vapi resources for this restaurant.</p>
          </div>
          <Button icon={<ShieldCheck size={16} />} disabled={Boolean(busyAction)} onClick={() => setPurchaseOpen(true)}>
            Review purchase
          </Button>
        </section>
      )}

      {provisioned && !releasePending && setup.forwardingMode !== 'none' && (
        <section className="space-y-4 border-b border-dash-border pb-6">
          <div>
            <h3 className="text-base font-semibold text-dash-cream">Forward your existing line</h3>
            <p className="mt-1 text-sm leading-6 text-dash-secondary">
              In your current carrier’s call-forwarding settings, send {setup.forwardingMode === 'all_calls' ? 'all calls' : 'busy and unanswered calls'} from {formatPhone(setup.forwardingFrom)} to the AI number below. Carrier steps vary, so use the carrier’s own portal or support instructions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-y border-dash-border px-3 py-4">
            <PhoneCall size={18} className="text-shell-accent" aria-hidden="true" />
            <span className="text-sm text-dash-secondary">Forward to</span>
            <strong className="text-lg text-dash-cream">{formatPhone(setup.voiceAgent.phoneNumber)}</strong>
            <button type="button" title="Copy forwarding destination" onClick={() => void copyNumber()} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-dash-secondary transition hover:bg-dash-cream/5 hover:text-dash-cream">
              <Copy size={15} aria-hidden="true" />
            </button>
          </div>
          {setup.verificationStatus === 'verified' ? (
            <div className="flex items-center gap-2 text-sm text-dash-success">
              <CheckCircle2 size={17} aria-hidden="true" />
              Forwarding verified by an inbound call.
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="max-w-2xl text-sm leading-6 text-dash-secondary">
                Start verification, then call the existing restaurant number from another phone within 15 minutes. Answering on the AI line marks setup complete.
              </p>
              {!readOnly && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={Boolean(busyAction)}
                  icon={busyAction === 'verification' ? <Loader2 size={15} className="animate-spin" /> : <PhoneCall size={15} />}
                  onClick={() => void startVerification()}
                >
                  {setup.verificationStatus === 'pending' ? 'Restart verification' : 'Start verification'}
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {provisioned && !releasePending && (
        <section className="flex flex-col gap-4 border-b border-dash-border pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-dash-cream">Service control</h3>
            <p className="mt-1 text-sm text-dash-secondary">
              {setup.voiceAgent.enabled ? 'The assigned number can receive restaurant calls.' : 'Calls are disabled until the service is activated.'}
            </p>
          </div>
          {!readOnly && (
            <Button
              variant={setup.voiceAgent.enabled ? 'danger' : 'success'}
              size="sm"
              disabled={Boolean(busyAction)}
              icon={busyAction === 'activation' ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
              onClick={() => void setEnabled(!setup.voiceAgent.enabled)}
            >
              {setup.voiceAgent.enabled ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </section>
      )}

      {setup?.status === 'released' && setup.releasedPhoneNumber && (
        <section className="border-y border-dash-border py-4">
          <p className="text-sm font-semibold text-dash-cream">Previous number released</p>
          <p className="mt-1 text-sm leading-6 text-dash-secondary">
            {formatPhone(setup.releasedPhoneNumber)} no longer renews through Twilio. Select a new number above to set up another line.
          </p>
        </section>
      )}

      {provisioned && managedReleaseAvailable && !readOnly && (
        <section className="flex flex-col gap-4 border-y border-dash-danger/35 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-dash-danger">Permanently release number</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-dash-secondary">
              Remove this number from Vapi and release it from Twilio. Calls stop immediately and future monthly number renewals end.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            disabled={Boolean(busyAction)}
            icon={<Trash2 size={15} />}
            onClick={() => setReleaseOpen(true)}
          >
            Permanently release
          </Button>
        </section>
      )}

      {readOnly && (
        <p className="flex items-center gap-2 text-xs text-dash-tertiary">
          <ShieldCheck size={14} aria-hidden="true" />
          This page is in summary mode. Change your Back Office view to edit phone setup.
        </p>
      )}

      <Modal isOpen={purchaseOpen} onClose={() => !busyAction && setPurchaseOpen(false)} title="Confirm phone number purchase" size="sm">
        <div className="space-y-5">
          <div>
            <p className="label-mono">Selected number</p>
            <p className="mt-2 text-2xl font-semibold text-dash-cream">{formatPhone(selectedNumber)}</p>
          </div>
          <p className="text-sm leading-6 text-dash-secondary">
            Shire will purchase this number from Twilio, create a restaurant-specific subaccount, configure the Vapi assistant, and assign the number. Provider charges begin when the purchase succeeds.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-dash-border p-3">
            <input
              type="checkbox"
              checked={purchaseConfirmed}
              onChange={(event) => setPurchaseConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--shell-accent)]"
            />
            <span className="text-sm leading-6 text-dash-secondary">I confirm this number should be purchased for this restaurant.</span>
          </label>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setPurchaseOpen(false)} disabled={busyAction === 'purchase'}>Cancel</Button>
            <Button
              disabled={!purchaseConfirmed || busyAction === 'purchase'}
              icon={busyAction === 'purchase' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
              onClick={() => void purchase()}
            >
              Purchase and configure
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      <Modal
        isOpen={releaseOpen}
        onClose={() => !busyAction && setReleaseOpen(false)}
        title="Permanently release phone number"
        size="sm"
      >
        <div className="space-y-5">
          <div className="border-y border-dash-danger/40 bg-dash-danger/10 px-4 py-3">
            <p className="text-sm font-semibold text-dash-danger">This cannot be undone in Shire.</p>
            <p className="mt-1 text-sm leading-6 text-dash-secondary">
              {formatPhone(selectedNumber)} will stop receiving calls and may be assigned to someone else. Twilio does not refund the current prepaid month.
            </p>
          </div>
          <TextField
            label={`Type ${formatPhone(selectedNumber)} to confirm`}
            type="tel"
            value={releaseConfirmation}
            placeholder={formatPhone(selectedNumber)}
            onChange={(event) => setReleaseConfirmation(event.target.value)}
            disabled={busyAction === 'release'}
          />
          <ModalFooter>
            <Button variant="ghost" onClick={() => setReleaseOpen(false)} disabled={busyAction === 'release'}>Keep number</Button>
            <Button
              variant="danger"
              disabled={
                busyAction === 'release'
                || nationalPhoneDigits(releaseConfirmation) !== nationalPhoneDigits(selectedNumber)
              }
              icon={busyAction === 'release' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              onClick={() => void releaseNumber()}
            >
              Release and stop renewals
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}
