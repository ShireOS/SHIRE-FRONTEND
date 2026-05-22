import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Link2,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react'
import { useAuth } from '../../../auth'

const isTechnicalValue = (value = '') =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ||
  /^[a-f0-9-]{24,}$/i.test(value)

const getSlug = (restaurant) => restaurant?.public_slug || restaurant?.slug || ''

const getLocationHint = (restaurant) => {
  if (!restaurant) return ''
  const cityState = [restaurant.city, restaurant.state].filter(Boolean).join(', ')
  return cityState || restaurant.address || restaurant.timezone || 'Location details pending'
}

const getSetupState = (restaurant) => {
  const slug = getSlug(restaurant)
  const hasFriendlySlug = Boolean(slug && !isTechnicalValue(slug))
  const isComplete = Boolean(restaurant?.onboarding_completed_at)

  if (isComplete && hasFriendlySlug) {
    return { label: 'Ready', className: 'text-dash-success', icon: CheckCircle2 }
  }

  return { label: 'Needs setup', className: 'text-dash-warning', icon: AlertTriangle }
}

export function RestaurantSwitcher() {
  const { restaurant, switchRestaurant } = useAuth()
  const { currentRestaurant, restaurants, isLoading } = restaurant
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [switchingId, setSwitchingId] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    setQuery('')
    setSwitchingId('')
  }, [currentRestaurant?.id])

  const filteredRestaurants = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return restaurants

    return restaurants.filter((item) => {
      const haystack = [
        item.name,
        item.city,
        item.state,
        item.address,
        item.public_slug,
        item.slug,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, restaurants])

  const activeSlug = getSlug(currentRestaurant)
  const activeStatus = getSetupState(currentRestaurant)
  const ActiveStatusIcon = activeStatus.icon

  const handleSwitch = async (restaurantId) => {
    if (!restaurantId || restaurantId === currentRestaurant?.id) {
      setIsOpen(false)
      return
    }

    setSwitchingId(restaurantId)
    await switchRestaurant(restaurantId)
    setIsOpen(false)
  }

  if (isLoading) {
    return (
      <div className="hidden lg:flex w-72 items-center gap-3 rounded-lg border border-dash-border bg-dash-cream/5 px-3 py-2 text-dash-secondary">
        <Loader2 size={16} className="animate-spin text-dash-gold" />
        <span className="truncate text-sm">Loading restaurants...</span>
      </div>
    )
  }

  if (!currentRestaurant) {
    return (
      <div className="hidden lg:flex w-72 items-center gap-3 rounded-lg border border-dash-warning/30 bg-dash-warning/10 px-3 py-2 text-dash-warning">
        <AlertTriangle size={16} />
        <span className="truncate text-sm">No restaurant selected</span>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative hidden lg:block w-72">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-dash-border bg-dash-cream/5 px-3 py-2 text-left transition-colors hover:border-dash-gold/30 hover:bg-dash-cream/10"
        aria-expanded={isOpen}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dash-gold/30 bg-dash-gold/15 text-dash-gold">
          <Building2 size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-dash-cream">{currentRestaurant.name}</p>
            <ActiveStatusIcon size={13} className={`shrink-0 ${activeStatus.className}`} />
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-dash-tertiary">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{getLocationHint(currentRestaurant)}</span>
          </div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-dash-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[28rem] overflow-hidden rounded-lg border border-dash-border bg-dash-surface shadow-2xl">
          <div className="border-b border-dash-border p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dash-tertiary" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search restaurants, city, or slug"
                className="w-full rounded-lg border border-dash-border bg-dash-base px-9 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-dash-gold/50"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-auto p-2">
            {filteredRestaurants.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-dash-tertiary">
                No restaurants match that search.
              </div>
            )}

            {filteredRestaurants.map((item) => {
              const slug = getSlug(item)
              const isActive = item.id === currentRestaurant.id
              const status = getSetupState(item)
              const StatusIcon = status.icon

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSwitch(item.id)}
                  className={`flex w-full min-w-0 items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-dash-gold/10 text-dash-cream'
                      : 'text-dash-secondary hover:bg-dash-cream/5 hover:text-dash-cream'
                  }`}
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    isActive
                      ? 'border-dash-gold/30 bg-dash-gold/15 text-dash-gold'
                      : 'border-dash-border bg-dash-base text-dash-tertiary'
                  }`}>
                    {switchingId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      {isActive && <CheckCircle2 size={13} className="shrink-0 text-dash-gold" />}
                    </div>
                    <p className="mt-1 truncate text-xs text-dash-tertiary">{getLocationHint(item)}</p>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 ${status.className}`}>
                        <StatusIcon size={12} />
                        {status.label}
                      </span>
                      {slug && (
                        <span className="inline-flex min-w-0 items-center gap-1 text-dash-tertiary">
                          <Link2 size={12} className="shrink-0" />
                          <span className="truncate font-dash-mono">/book/{slug}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="border-t border-dash-border px-3 py-2 text-xs text-dash-tertiary">
            {restaurants.length} restaurant{restaurants.length === 1 ? '' : 's'} available to this owner.
          </div>
        </div>
      )}

      {activeSlug && (
        <div className="pointer-events-none mt-1 truncate px-1 font-dash-mono text-[10px] text-dash-tertiary">
          /book/{activeSlug}
        </div>
      )}
    </div>
  )
}
