import { motion } from 'framer-motion'
import { Grid3X3, RotateCcw } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { cn } from '../../lib/cn'

export function ServerModeToggle() {
  const serverMode = useRestaurantStore((s) => s.serverMode)
  const setServerMode = useRestaurantStore((s) => s.setServerMode)

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="label-mono">Mode</span>
      <div className="flex p-0.5 rounded-lg bg-black/30">
        <button
          onClick={() => setServerMode('sections')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            serverMode === 'sections'
              ? 'bg-white/[0.08] text-primary'
              : 'text-secondary hover:text-primary'
          )}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          Sections
        </button>
        <button
          onClick={() => setServerMode('rotations')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            serverMode === 'rotations'
              ? 'bg-white/[0.08] text-primary'
              : 'text-secondary hover:text-primary'
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Rotations
        </button>
      </div>

      {/* Server Info */}
      {serverMode === 'rotations' && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 ml-auto"
        >
          <span className="label-mono">Next</span>
          <span className="text-xs font-semibold text-accent-primary">James</span>
        </motion.div>
      )}
    </div>
  )
}
