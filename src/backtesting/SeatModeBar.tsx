import { useRestaurantStore } from '../host/stores/restaurantStore'
import { cn } from '../host/lib/cn'

const PREFERENCE_BUTTONS = [
  { key: 'indoor', label: 'Indoor' },
  { key: 'outdoor', label: 'Outdoor' },
  { key: 'bar', label: 'Bar' },
] as const

export function SeatModeBar() {
  const seatPreferences = useRestaurantStore((s) => s.seatPreferences)
  const seatMode = useRestaurantStore((s) => s.seatMode)
  const toggleSeatPreference = useRestaurantStore((s) => s.toggleSeatPreference)
  const setSeatMode = useRestaurantStore((s) => s.setSeatMode)

  return (
    <div className="flex border-b border-white/[0.06]">
      {PREFERENCE_BUTTONS.map(({ key, label }) => {
        const isActive = seatPreferences.includes(key) && seatMode === 'preference'
        return (
          <button
            key={key}
            onClick={() => {
              if (seatMode === 'custom') setSeatMode('preference')
              toggleSeatPreference(key)
            }}
            className={cn(
              'flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-r border-white/[0.06] last:border-r-0',
              isActive
                ? 'bg-accent-green/15 text-accent-green'
                : 'text-secondary hover:bg-white/[0.04] hover:text-primary'
            )}
          >
            {label}
          </button>
        )
      })}

      {/* Custom — exclusive mode button */}
      <button
        onClick={() => setSeatMode(seatMode === 'custom' ? 'preference' : 'custom')}
        className={cn(
          'flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-all',
          seatMode === 'custom'
            ? 'bg-accent-blue/15 text-accent-blue'
            : 'text-secondary hover:bg-white/[0.04] hover:text-primary'
        )}
      >
        Custom
      </button>
    </div>
  )
}
