import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Globe,
  Link,
  Loader2,
  Save,
  SearchCheck,
} from 'lucide-react'
import { Card, CardContent } from '../shared/Card'
import { Button } from '../shared/Button'
import { Badge } from '../shared/Badge'
import { API_CONFIG } from '../../../shared/api/config'
import {
  useGoogleReservationConnection,
  useUpdateGoogleReservationConnection,
} from '../../../shared/hooks'

const getPublicSiteUrl = () => {
  const configuredUrl = API_CONFIG.publicSiteUrl?.trim()
  if (configuredUrl) return configuredUrl.replace(/\/$/, '')
  return window.location.origin
}

const isTechnicalValue = (value = '') =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ||
  /^[a-f0-9-]{24,}$/i.test(value)

const copyToClipboard = async (value) => {
  await navigator.clipboard.writeText(value)
}

function LinkBox({ label, value, onCopy, onOpen, copied }) {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-base/40 p-4">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-dash-tertiary">{label}</p>
          <p className="mt-2 font-dash-mono text-sm text-dash-cream break-all">{value}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" size="sm" icon={<Copy size={14} />} onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button type="button" variant="outline" size="sm" icon={<ExternalLink size={14} />} onClick={onOpen}>
          Test
        </Button>
      </div>
    </div>
  )
}

function SetupCheck({ complete, label, detail }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dash-border bg-dash-base/30 p-3">
      {complete ? (
        <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-dash-success" />
      ) : (
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-dash-warning" />
      )}
      <div>
        <p className="text-sm font-medium text-dash-cream">{label}</p>
        <p className="mt-0.5 text-xs text-dash-tertiary">{detail}</p>
      </div>
    </div>
  )
}

export function GoogleSetupTab({ locationId, restaurant, settings }) {
  const [copiedTarget, setCopiedTarget] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const slug = restaurant?.slug
  const restaurantName = restaurant?.name || ''
  const hasGuestReadyName = Boolean(restaurantName && !isTechnicalValue(restaurantName))
  const displayRestaurantName = hasGuestReadyName ? restaurantName : 'Restaurant name not set'

  const urls = useMemo(() => {
    if (!slug) return { website: '', google: '' }
    const baseUrl = `${getPublicSiteUrl()}/book/${encodeURIComponent(slug)}`
    return {
      website: baseUrl,
      google: `${baseUrl}?source=google`,
    }
  }, [slug])

  const activeServicePeriods = settings?.service_periods?.filter((period) => period.is_active) || []
  const publicChannels = settings?.channel_rules?.filter((rule) =>
    ['web', 'app'].includes(rule.channel)
  ) || []
  const hasPublicChannel = publicChannels.some((rule) => rule.is_enabled)
  const hasPacingRule = Boolean(settings?.pacing_rules?.some((rule) => rule.is_active !== false))
  const hasFriendlySlug = Boolean(slug && !isTechnicalValue(slug))

  const connectionQuery = useGoogleReservationConnection(locationId)
  const updateConnection = useUpdateGoogleReservationConnection(locationId)
  const connection = connectionQuery.data
  const connectionStatus = connection?.connectionStatus || 'disconnected'
  const isConnected = connectionStatus === 'connected'

  const exportText = useMemo(() => {
    if (!urls.google) return ''
    return [
      `Restaurant: ${displayRestaurantName}`,
      `Google reservation URL: ${urls.google}`,
      `Public website URL: ${urls.website}`,
      `Location ID: ${locationId}`,
      `Slug: ${slug}`,
    ].join('\n')
  }, [displayRestaurantName, locationId, slug, urls.google, urls.website])

  const handleCopy = async (target, value) => {
    if (!value) return
    await copyToClipboard(value)
    setCopiedTarget(target)
    window.setTimeout(() => setCopiedTarget(''), 1800)
  }

  const handleOpen = (value) => {
    if (!value) return
    window.open(value, '_blank', 'noopener,noreferrer')
  }

  const handleSave = async () => {
    if (!urls.google) return
    setSaveMessage('')
    try {
      await updateConnection.save({
        redirectBookingUrl: urls.google,
        connectionStatus: 'connected',
      })
      setSaveMessage('Google booking connection saved.')
      connectionQuery.refetch()
    } catch {
      setSaveMessage('')
    }
  }

  if (!locationId) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-dash-tertiary">
          Select a restaurant before setting up Google reservations.
        </CardContent>
      </Card>
    )
  }

  if (!slug) {
    return (
      <Card className="border border-dash-warning/30">
        <CardContent className="p-6">
          <h3 className="font-semibold text-dash-warning mb-2">Restaurant slug required</h3>
          <p className="text-sm text-dash-tertiary">
            This restaurant needs a public slug before SHIRE can generate booking links.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <SearchCheck size={20} className="text-dash-gold" />
                <h3 className="font-semibold text-dash-cream">Google reservation export</h3>
              </div>
              <p className="text-sm text-dash-tertiary max-w-2xl">
                Use this link for Google Business Profile, website buttons, QR codes, and owner handoff.
              </p>
            </div>
            <Badge variant={isConnected ? 'success' : 'neutral'} dot>
              {isConnected ? 'Saved to Google channel' : 'Not saved'}
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <LinkBox
              label="Google Business Profile URL"
              value={urls.google}
              copied={copiedTarget === 'google'}
              onCopy={() => handleCopy('google', urls.google)}
              onOpen={() => handleOpen(urls.google)}
            />
            <LinkBox
              label="Website / direct guest URL"
              value={urls.website}
              copied={copiedTarget === 'website'}
              onCopy={() => handleCopy('website', urls.website)}
              onOpen={() => handleOpen(urls.website)}
            />
          </div>

          {isTechnicalValue(slug) && (
            <div className="mt-4 rounded-lg border border-dash-warning/30 bg-dash-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-dash-warning" />
                <div>
                  <p className="text-sm font-medium text-dash-warning">This public URL is using a technical slug.</p>
                  <p className="mt-1 text-sm text-dash-tertiary">
                    It works, but a restaurant-facing link should use something like mimosas or mimosas-myrtle-beach.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasGuestReadyName && (
            <div className="mt-4 rounded-lg border border-dash-warning/30 bg-dash-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-dash-warning" />
                <div>
                  <p className="text-sm font-medium text-dash-warning">The guest-facing restaurant name is not ready.</p>
                  <p className="mt-1 text-sm text-dash-tertiary">
                    Guests should see a real venue name, like Mimosas Southern Kitchen & Bar, before this link goes into Google.
                  </p>
                </div>
              </div>
            </div>
          )}

          {connectionQuery.error && (
            <p className="mt-3 text-sm text-dash-warning">
              Existing Google connection could not be loaded: {connectionQuery.error.message}
            </p>
          )}

          {updateConnection.error && (
            <p className="mt-3 text-sm text-dash-danger">
              Could not save Google connection: {updateConnection.error.message}
            </p>
          )}

          {saveMessage && (
            <p className="mt-3 text-sm text-dash-success">{saveMessage}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              icon={updateConnection.loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              disabled={updateConnection.loading}
              onClick={handleSave}
            >
              Save Google Connection
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<ClipboardList size={16} />}
              onClick={() => handleCopy('export', exportText)}
            >
              {copiedTarget === 'export' ? 'Copied Export' : 'Copy Export'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-dash-success" />
              <h3 className="font-semibold text-dash-cream">Reservation readiness</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SetupCheck
                complete={activeServicePeriods.length > 0}
                label="Service hours"
                detail={`${activeServicePeriods.length} active service period${activeServicePeriods.length === 1 ? '' : 's'}`}
              />
              <SetupCheck
                complete={hasPublicChannel}
                label="Public channel"
                detail={hasPublicChannel ? 'Website or app booking is enabled.' : 'Enable Website in Booking Rules.'}
              />
              <SetupCheck
                complete={hasPacingRule}
                label="Pacing rules"
                detail={hasPacingRule ? 'Cover limits are configured.' : 'Add a pacing rule before sending traffic.'}
              />
              <SetupCheck
                complete={hasGuestReadyName}
                label="Restaurant name"
                detail={hasGuestReadyName ? displayRestaurantName : 'Set a real guest-facing restaurant name.'}
              />
              <SetupCheck
                complete={hasFriendlySlug}
                label="Friendly URL"
                detail={hasFriendlySlug ? `Slug: ${slug}` : 'Use a readable slug before sharing with guests.'}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Globe size={18} className="text-dash-gold" />
              <h3 className="font-semibold text-dash-cream">Where to configure</h3>
            </div>
            <div className="space-y-3 text-sm text-dash-secondary">
              <p><span className="text-dash-cream">Service Hours:</span> dates, days, time windows, party limits.</p>
              <p><span className="text-dash-cream">Booking Rules:</span> public channels and pacing limits.</p>
              <p><span className="text-dash-cream">Blackouts:</span> closures and partial-day blocks.</p>
              <p><span className="text-dash-cream">Google Setup:</span> copy, test, and save the export URL.</p>
            </div>
            <div className="mt-5 rounded-lg border border-dash-border bg-dash-base/40 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-dash-tertiary">
                <Link size={14} />
                Public identity
              </div>
              <p className="mt-2 text-sm text-dash-cream break-all">{displayRestaurantName}</p>
              <p className="mt-1 font-dash-mono text-xs text-dash-tertiary break-all">{slug}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
