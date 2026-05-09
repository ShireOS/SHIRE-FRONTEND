import { useMemo, useState } from 'react'
import { Copy, ExternalLink, Loader2, Save, SearchCheck } from 'lucide-react'
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

export function GoogleSetupTab({ locationId, restaurant }) {
  const [copied, setCopied] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const slug = restaurant?.slug
  const bookingUrl = useMemo(
    () => (slug ? `${getPublicSiteUrl()}/book/${encodeURIComponent(slug)}?source=google` : ''),
    [slug]
  )
  const connectionQuery = useGoogleReservationConnection(locationId)
  const updateConnection = useUpdateGoogleReservationConnection(locationId)
  const connection = connectionQuery.data
  const connectionStatus = connection?.connectionStatus || 'disconnected'
  const isConnected = connectionStatus === 'connected'

  const handleCopy = async () => {
    if (!bookingUrl) return
    await navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const handleOpen = () => {
    if (!bookingUrl) return
    window.open(bookingUrl, '_blank', 'noopener,noreferrer')
  }

  const handleSave = async () => {
    if (!bookingUrl) return
    setSaveMessage('')
    try {
      await updateConnection.save({
        redirectBookingUrl: bookingUrl,
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
            This restaurant needs a public slug before SHIRE can generate a Google booking link.
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
              <div className="flex items-center gap-2 mb-2">
                <SearchCheck size={20} className="text-dash-gold" />
                <h3 className="font-semibold text-dash-cream">Google Business Profile booking link</h3>
              </div>
              <p className="text-sm text-dash-tertiary max-w-2xl">
                Copy this exact URL into Google so guests can reserve directly from this restaurant's public profile.
              </p>
            </div>
            <Badge variant={isConnected ? 'success' : 'neutral'} dot>
              {isConnected ? 'Connected' : 'Not connected'}
            </Badge>
          </div>

          <div className="mt-5 rounded-lg border border-dash-border bg-dash-base/40 p-4">
            <p className="text-xs uppercase tracking-wide text-dash-tertiary mb-2">Booking URL</p>
            <p className="font-dash-mono text-sm text-dash-cream break-all">{bookingUrl}</p>
          </div>

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
              variant="secondary"
              icon={<Copy size={16} />}
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
            <Button
              type="button"
              variant="outline"
              icon={<ExternalLink size={16} />}
              onClick={handleOpen}
            >
              Test Link
            </Button>
            <Button
              type="button"
              icon={updateConnection.loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              disabled={updateConnection.loading}
              onClick={handleSave}
            >
              Save Google Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-dash-cream mb-4">Owner setup instructions</h3>
          <ol className="space-y-3 text-sm text-dash-secondary list-decimal list-inside">
            <li>Copy the booking URL above.</li>
            <li>Open Google Business Profile.</li>
            <li>Go to the restaurant profile edit screen.</li>
            <li>Add the copied URL as the reservation or booking link.</li>
            <li>Save the Google connection in SHIRE.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
