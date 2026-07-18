import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, Monitor, Search, Settings2 } from 'lucide-react'
import { useAuth } from '../../auth'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import StoreDevicesPanel from '../components/devices/StoreDevicesPanel'
import { deviceTypeLabel, fetchPortfolioDevices, isDeviceOnline } from '../data/devices'
import { fetchDeviceAccessibleRestaurantIds } from '../data/resellerAccess'

function SummaryTile({ label, value, tone = 'text-dash-cream' }) {
  return (
    <div className="glass-panel rounded-xl border border-dash-border px-4 py-3">
      <p className="label-mono">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

// Portfolio-wide IT view: every device across every store the viewer can
// reach (reseller portfolio, admin everything, owner their stores), with a
// per-store drill-in for printers, print groups, and device config.
export default function DevicesPage() {
  const auth = useAuth()
  const restaurants = auth.restaurant.restaurants || []
  const [accessibleRestaurantIds, setAccessibleRestaurantIds] = useState(null)
  const accessibleIdSet = useMemo(
    () => new Set(accessibleRestaurantIds || []),
    [accessibleRestaurantIds]
  )
  const accessibleRestaurants = useMemo(
    () => restaurants.filter((restaurant) => accessibleIdSet.has(restaurant.id)),
    [accessibleIdSet, restaurants]
  )
  const restaurantsById = useMemo(
    () => Object.fromEntries(accessibleRestaurants.map((r) => [r.id, r])),
    [accessibleRestaurants]
  )

  const [devices, setDevices] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setDevices(null)
    setAccessibleRestaurantIds(null)
    setSelectedStoreId(null)
    fetchDeviceAccessibleRestaurantIds({
      accountType: auth.accountType,
      userId: auth.user?.id,
      restaurantIds: restaurants.map((restaurant) => restaurant.id),
      ownedRestaurantIds: restaurants
        .filter((restaurant) => restaurant.owner_id === auth.user?.id)
        .map((restaurant) => restaurant.id),
    })
      .then(async (allowedIds) => {
        if (cancelled) return
        setAccessibleRestaurantIds(allowedIds)
        const rows = await fetchPortfolioDevices(allowedIds)
        if (!cancelled) {
          setDevices(rows)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAccessibleRestaurantIds([])
          setDevices([])
          setError(err.message || 'Could not load device access')
        }
      })
    return () => { cancelled = true }
    // Reload when the portfolio itself changes, not on unrelated auth churn.
  }, [auth.accountType, auth.user?.id, restaurants.map((r) => r.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!devices) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return devices
    return devices.filter((device) => {
      const storeName = restaurantsById[device.restaurant_id]?.name || ''
      return (device.name || '').toLowerCase().includes(needle)
        || storeName.toLowerCase().includes(needle)
        || deviceTypeLabel(device.device_type).toLowerCase().includes(needle)
    })
  }, [devices, query, restaurantsById])

  if (selectedStoreId) {
    const store = restaurantsById[selectedStoreId]
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedStoreId(null)}
            icon={<ArrowLeft size={15} aria-hidden="true" />}
          >
            All devices
          </Button>
          <h1 className="text-xl font-semibold text-dash-cream">{store?.name || 'Store'}</h1>
          <span className="label-mono">Devices & printing</span>
        </div>
        <StoreDevicesPanel restaurantId={selectedStoreId} />
      </div>
    )
  }

  const online = (devices || []).filter((d) => d.status !== 'revoked' && isDeviceOnline(d)).length
  const active = (devices || []).filter((d) => d.status !== 'revoked').length

  if (
    accessibleRestaurantIds !== null
    && ['reseller', 'reseller_employee'].includes(auth.accountType)
    && accessibleRestaurants.length === 0
  ) {
    return <Navigate to="/reseller" replace />
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Stores" value={accessibleRestaurants.length} />
        <SummaryTile label="Devices" value={active} />
        <SummaryTile label="Online" value={online} tone="text-dash-success" />
        <SummaryTile label="Offline" value={active - online} tone={active - online > 0 ? 'text-dash-warning' : 'text-dash-cream'} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="glass-panel flex min-h-[38px] flex-1 items-center gap-2 rounded-xl border border-dash-border px-3 text-sm md:max-w-xs">
          <Search size={14} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices or stores…"
            className="w-full bg-transparent text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
          />
        </label>
        <span className="label-mono ml-auto">
          Select a store row to configure printers & pairing
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-dash-danger/40 bg-dash-danger/10 px-4 py-3 text-sm text-dash-danger">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="!p-0">
          {devices === null ? (
            <p className="px-6 py-8 text-sm text-dash-secondary">Loading devices…</p>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Monitor size={22} strokeWidth={1.5} className="mx-auto text-dash-tertiary" aria-hidden="true" />
              <p className="mt-3 text-sm text-dash-secondary">
                {devices.length === 0
                  ? 'No devices paired yet. Open a store below to generate a pairing code.'
                  : 'No devices match your search.'}
              </p>
              {devices.length === 0 && accessibleRestaurants.length > 0 && (
                <Button className="mt-4" size="sm" onClick={() => setSelectedStoreId(accessibleRestaurants[0].id)}>
                  Set up {accessibleRestaurants[0].name || 'first store'}
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-dash-border">
              {filtered.map((device) => {
                const store = restaurantsById[device.restaurant_id]
                const revoked = device.status === 'revoked'
                const isOnline = !revoked && isDeviceOnline(device)
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => setSelectedStoreId(device.restaurant_id)}
                    title={`Configure ${store?.name || 'store'} devices`}
                    className="flex w-full flex-wrap items-center gap-3 px-6 py-3.5 text-left transition hover:bg-[var(--glass-bg-hover)]"
                  >
                    <Monitor size={15} strokeWidth={1.75} className="shrink-0 text-dash-tertiary" aria-hidden="true" />
                    <span className={`min-w-0 truncate text-sm font-semibold ${revoked ? 'text-dash-tertiary line-through' : 'text-dash-cream'}`}>
                      {device.name || 'Unnamed device'}
                    </span>
                    <span className="text-xs text-dash-tertiary">{deviceTypeLabel(device.device_type)}</span>
                    <Badge variant={revoked ? 'danger' : isOnline ? 'success' : 'neutral'} dot={!revoked}>
                      {revoked ? 'Deactivated' : isOnline ? 'Online' : 'Offline'}
                    </Badge>
                    <span className="ml-auto flex items-center gap-2 text-xs text-dash-secondary">
                      {store?.name || 'Unknown store'}
                      <Settings2 size={14} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {accessibleRestaurants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accessibleRestaurants.map((store) => (
            <button
              key={store.id}
              type="button"
              onClick={() => setSelectedStoreId(store.id)}
              className="rounded-full border border-dash-border bg-[var(--glass-bg)] px-3.5 py-1.5 text-xs font-medium text-dash-secondary transition hover:border-shell-accent/50 hover:text-shell-accent"
            >
              {store.name || 'Untitled restaurant'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
