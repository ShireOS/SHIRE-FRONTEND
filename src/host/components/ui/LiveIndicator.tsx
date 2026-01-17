import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

interface LiveIndicatorProps {
  className?: string
}

export function LiveIndicator({ className }: LiveIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-accent-green/30"
          animate={{
            scale: [1, 2, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        {/* Inner solid dot */}
        <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
      </div>
      <span className="font-data text-[10px] font-medium uppercase tracking-wider text-accent-green">
        Live
      </span>
    </div>
  )
}
