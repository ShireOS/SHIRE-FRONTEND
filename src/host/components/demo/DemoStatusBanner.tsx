import { useRestaurantStore } from '../../stores/restaurantStore'
import { formatDistanceToNow } from 'date-fns'

export function DemoStatusBanner() {
  const demoActive = useRestaurantStore((s) => s.demoActive)
  const wsConnected = useRestaurantStore((s) => s.wsConnected)
  const lastUpdate = useRestaurantStore((s) => s.lastCvUpdate)
  const demoStatus = useRestaurantStore((s) => s.demoStatus)

  if (!demoActive) return null

  return (
    <div className="glass-panel-flat px-4 py-2 flex items-center gap-4 text-sm">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
        />
        <span className="font-medium">Live Mode</span>
      </div>

      {/* Demo Info */}
      {demoStatus && (
        <div className="text-xs opacity-70">
          Speed: {demoStatus.speed}x | Camera: {demoStatus.cameras.join(', ')}
        </div>
      )}

      {/* Last Update */}
      {lastUpdate && (
        <div className="text-xs opacity-70">
          Last CV update: {formatDistanceToNow(lastUpdate, { addSuffix: true })}
        </div>
      )}

      {/* Connection Status Text */}
      <div className="ml-auto text-xs opacity-60">
        {wsConnected ? 'Live' : 'Disconnected'}
      </div>
    </div>
  )
}
