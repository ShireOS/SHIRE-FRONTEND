import { cn } from '../../lib/cn'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  padding?: boolean
  animate?: boolean
}

export function GlassPanel({ children, className, padding = true, animate = false }: GlassPanelProps) {
  const Component = animate ? motion.div : 'div'

  return (
    <Component
      className={cn(
        'glass-panel',
        padding && 'p-4',
        className
      )}
      {...(animate && {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 }
      })}
    >
      {children}
    </Component>
  )
}
