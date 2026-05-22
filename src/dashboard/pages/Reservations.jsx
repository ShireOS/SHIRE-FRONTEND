import { useState, useCallback } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { ServicePeriodsTab } from '../components/reservations/ServicePeriodsTab'
import { BookingRulesTab } from '../components/reservations/BookingRulesTab'
import { BlackoutsTab } from '../components/reservations/BlackoutsTab'
import { GoogleSetupTab } from '../components/reservations/GoogleSetupTab'
import {
  AlertTriangle,
  Building2,
  Settings as SettingsIcon,
  Clock,
  ShieldCheck,
  CalendarX2,
  CalendarClock,
  Zap,
  Users,
  CheckCircle2,
  Globe,
  Link2,
  SearchCheck,
} from 'lucide-react'
import { useAuth } from '../../auth'
import {
  useReservationSettings,
  useUpdateReservationSettings,
  useReservationBlackouts,
  useCreateBlackout,
  useUpdateBlackout,
  useGoogleReservationConnection,
} from '../../shared/hooks'
import { reservationBootstrapDefaults } from '../data/mockData'

const tabs = [
  { id: 'settings', label: 'Reservation Settings', icon: SettingsIcon },
  { id: 'service-hours', label: 'Service Hours', icon: Clock },
  { id: 'booking-rules', label: 'Booking Rules', icon: ShieldCheck },
  { id: 'blackouts', label: 'Blackouts / Closures', icon: CalendarX2 },
  { id: 'google-setup', label: 'Google Setup', icon: SearchCheck },
]

export function Reservations() {
  const [activeTab, setActiveTab] = useState('settings')
  const { restaurant } = useAuth()
  const currentRestaurant = restaurant?.currentRestaurant
  const locationId = currentRestaurant?.id

  // API hooks
  const settingsQuery = useReservationSettings(locationId)
  const blackoutsQuery = useReservationBlackouts(locationId)
  const googleConnectionQuery = useGoogleReservationConnection(locationId)
  const { save: saveSettings } = useUpdateReservationSettings(locationId)
  const { create: createBlackout } = useCreateBlackout(locationId)
  const { update: updateBlackout } = useUpdateBlackout(locationId)

  const settings = settingsQuery.data
  const blackouts = blackoutsQuery.data || []
  const settingsUnavailable = !settingsQuery.loading && !settings
  const blackoutsUnavailable = !blackoutsQuery.loading && !!blackoutsQuery.error
  const canEditConfiguredSettings = Boolean(settings)
  const needsBootstrap = Boolean(
    settings &&
    settings.service_periods.length === 0 &&
    settings.pacing_rules.length === 0 &&
    settings.channel_rules.length === 0
  )

  // Handlers
  const handleSaveServicePeriods = useCallback(
    async (updatedPeriods) => {
      if (!settings) return
      try {
        await saveSettings({ ...settings, service_periods: updatedPeriods })
        settingsQuery.refetch()
      } catch {
        // Error displayed by hook
      }
    },
    [settings, saveSettings, settingsQuery]
  )

  const handleSaveBookingRules = useCallback(
    async ({ pacing_rules, channel_rules }) => {
      if (!settings) return
      try {
        await saveSettings({ ...settings, pacing_rules, channel_rules })
        settingsQuery.refetch()
      } catch {
        // Error displayed by hook
      }
    },
    [settings, saveSettings, settingsQuery]
  )

  const handleSaveDefaults = useCallback(
    async (updates) => {
      if (!settings) return
      try {
        await saveSettings({ ...settings, ...updates })
        settingsQuery.refetch()
      } catch {
        // Error displayed by hook
      }
    },
    [settings, saveSettings, settingsQuery]
  )

  const handleCreateBlackout = useCallback(
    async (payload) => {
      try {
        await createBlackout(payload)
        blackoutsQuery.refetch()
      } catch {
        // Error displayed by hook
      }
    },
    [createBlackout, blackoutsQuery]
  )

  const handleCancelBlackout = useCallback(
    async (blackoutId) => {
      try {
        await updateBlackout(blackoutId, { status: 'cancelled' })
        blackoutsQuery.refetch()
      } catch {
        // Error displayed by hook
      }
    },
    [updateBlackout, blackoutsQuery]
  )

  const handleBootstrap = useCallback(async () => {
    try {
      await saveSettings({
        ...settings,
        ...reservationBootstrapDefaults,
        location_id: locationId || 'default',
      })
      settingsQuery.refetch()
    } catch {
      // Error displayed by hook
    }
  }, [saveSettings, settings, locationId, settingsQuery])

  // Quick stats
  const activePeriods = settings?.service_periods?.filter((sp) => sp.is_active).length || 0
  const activeChannels = settings?.channel_rules?.filter((ch) => ch.is_enabled).length || 0
  const activeBlackouts = blackouts.filter((b) => b.status === 'active').length
  const publicSlug = currentRestaurant?.public_slug || currentRestaurant?.slug || ''
  const publicChannels = settings?.channel_rules?.filter((rule) =>
    ['web', 'app'].includes(rule.channel)
  ) || []
  const hasPublicChannel = publicChannels.some((rule) => rule.is_enabled)
  const hasPacingRule = Boolean(settings?.pacing_rules?.some((rule) => rule.is_active !== false))
  const googleConnected = googleConnectionQuery.data?.connectionStatus === 'connected'
  const readinessItems = [
    Boolean(activePeriods),
    hasPublicChannel,
    hasPacingRule,
    Boolean(publicSlug),
    googleConnected,
  ]
  const readyCount = readinessItems.filter(Boolean).length

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dash-cream">
          <span className="font-dash-display italic text-dash-gold">Reservations</span>
        </h1>
        <p className="text-dash-secondary mt-1">Configure reservation settings, service periods, and blackouts</p>
      </div>

      {!locationId && (
        <Card className="mb-6 border border-dash-warning/30">
          <CardContent className="p-5">
            <p className="text-dash-warning font-medium">No restaurant is selected.</p>
            <p className="text-dash-tertiary text-sm mt-1">
              Reservations config needs an active restaurant ID before it can load or save.
            </p>
          </CardContent>
        </Card>
      )}

      {settingsUnavailable && (
        <Card className="mb-6 border border-dash-danger/30">
          <CardContent className="p-5">
            <p className="text-dash-danger font-medium">Could not load reservation settings from the backend.</p>
            <p className="text-dash-tertiary text-sm mt-1">
              {settingsQuery.error?.message || 'The backend did not return reservation settings.'}
            </p>
          </CardContent>
        </Card>
      )}

      {blackoutsUnavailable && (
        <Card className="mb-6 border border-dash-warning/30">
          <CardContent className="p-5">
            <p className="text-dash-warning font-medium">Blackouts could not be loaded.</p>
            <p className="text-dash-tertiary text-sm mt-1">
              {blackoutsQuery.error?.message || 'The backend did not return reservation blackouts.'}
            </p>
          </CardContent>
        </Card>
      )}

      {locationId && (
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_0.9fr]">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dash-gold/30 bg-dash-gold/15 text-dash-gold">
                  <Building2 size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-dash-tertiary">Active restaurant</p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-dash-cream">{currentRestaurant?.name}</h2>
                  <p className="mt-1 truncate text-sm text-dash-secondary">
                    {[currentRestaurant?.city, currentRestaurant?.state].filter(Boolean).join(', ') || currentRestaurant?.address || 'Location profile pending'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dash-border bg-dash-base/40 text-dash-cream">
                  <Link2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-dash-tertiary">Public booking URL</p>
                  <p className="mt-1 truncate font-dash-mono text-sm text-dash-cream">
                    {publicSlug ? `/book/${publicSlug}` : 'Slug not configured'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('google-setup')}
                    className="mt-2 text-xs font-medium text-dash-gold transition-colors hover:text-dash-cream"
                  >
                    Manage Google setup
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={readyCount === readinessItems.length ? 'border border-dash-success/30' : 'border border-dash-warning/30'}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-dash-tertiary">Reservation readiness</p>
                  <p className="mt-1 text-2xl font-bold text-dash-cream">{readyCount}/{readinessItems.length}</p>
                  <p className="mt-1 text-sm text-dash-secondary">Google, public URL, pacing, and hours</p>
                </div>
                {readyCount === readinessItems.length ? (
                  <CheckCircle2 size={22} className="text-dash-success" />
                ) : (
                  <AlertTriangle size={22} className="text-dash-warning" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-dash-border">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-dash-gold text-dash-gold'
                  : 'border-transparent text-dash-secondary hover:text-dash-cream'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab 1: Reservation Settings (overview / defaults) */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {settingsQuery.loading && (
            <Card>
              <CardContent className="p-6 text-center text-dash-tertiary">
                Loading reservation settings...
              </CardContent>
            </Card>
          )}

          {needsBootstrap && (
            <Card>
              <CardContent className="p-6 text-center">
                <Users size={28} className="mx-auto text-dash-tertiary mb-3" />
                <h3 className="font-semibold text-dash-cream mb-2">Reservations need starter defaults</h3>
                <p className="text-sm text-dash-tertiary mb-4 max-w-md mx-auto">
                  This location has reservation settings, but no service periods, pacing rules, or channel rules yet.
                </p>
                <Button onClick={handleBootstrap}>
                  Initialize Default Settings
                </Button>
              </CardContent>
            </Card>
          )}

          {settings && (
            <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CalendarClock size={18} className="text-dash-gold" />
                  <p className="text-2xl font-bold text-dash-cream">{activePeriods}</p>
                </div>
                <p className="text-sm text-dash-tertiary">Active Service Periods</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Globe size={18} className="text-dash-success" />
                  <p className="text-2xl font-bold text-dash-cream">{activeChannels}</p>
                </div>
                <p className="text-sm text-dash-tertiary">Active Channels</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CalendarX2 size={18} className="text-dash-warning" />
                  <p className="text-2xl font-bold text-dash-cream">{activeBlackouts}</p>
                </div>
                <p className="text-sm text-dash-tertiary">Upcoming Blackouts</p>
              </CardContent>
            </Card>
          </div>

          {/* Default Settings Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Slot & Party Defaults */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-dash-cream mb-4 flex items-center gap-2">
                  <Zap size={18} className="text-dash-gold" />
                  Default Configuration
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-dash-border">
                    <span className="text-dash-secondary text-sm">Default Slot Interval</span>
                    <span className="text-dash-cream font-medium">{settings.default_slot_interval_minutes} min</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-dash-border">
                    <span className="text-dash-secondary text-sm">Party Size Range</span>
                    <span className="text-dash-cream font-medium">
                      {settings.default_min_party_size} - {settings.default_max_party_size} guests
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-dash-border">
                    <span className="text-dash-secondary text-sm">Confirmation Lead Time</span>
                    <span className="text-dash-cream font-medium">{settings.confirmation_lead_hours}h</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-dash-secondary text-sm">Auto-Confirm</span>
                    <Badge variant={settings.auto_confirm ? 'success' : 'neutral'} dot>
                      {settings.auto_confirm ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Channels Summary */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-dash-cream mb-4 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-dash-success" />
                  Channel Status
                </h3>
                <div className="space-y-3">
                  {settings.channel_rules?.map((rule) => (
                    <div key={rule.channel} className="flex items-center justify-between py-2 border-b border-dash-border last:border-0">
                      <span className="text-dash-secondary text-sm capitalize">{rule.channel}</span>
                      <Badge variant={rule.is_enabled ? 'success' : 'neutral'} dot>
                        {rule.is_enabled ? 'Active' : 'Off'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Service Hours */}
      {activeTab === 'service-hours' && (
        canEditConfiguredSettings ? (
          <ServicePeriodsTab
            servicePeriods={settings.service_periods || []}
            onSave={handleSaveServicePeriods}
          />
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-dash-tertiary">
              Initialize reservation settings before editing service hours.
            </CardContent>
          </Card>
        )
      )}

      {/* Tab 3: Booking Rules */}
      {activeTab === 'booking-rules' && (
        canEditConfiguredSettings ? (
          <BookingRulesTab
            pacingRules={settings.pacing_rules || []}
            channelRules={settings.channel_rules || []}
            onSave={handleSaveBookingRules}
          />
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-dash-tertiary">
              Initialize reservation settings before editing booking rules.
            </CardContent>
          </Card>
        )
      )}

      {/* Tab 4: Blackouts / Closures */}
      {activeTab === 'blackouts' && (
        <BlackoutsTab
          blackouts={blackouts}
          onCreate={handleCreateBlackout}
          onCancel={handleCancelBlackout}
        />
      )}

      {/* Tab 5: Google Setup */}
      {activeTab === 'google-setup' && (
        <GoogleSetupTab
          locationId={locationId}
          restaurant={currentRestaurant}
          settings={settings}
          onNavigateTab={setActiveTab}
        />
      )}
    </div>
  )
}
