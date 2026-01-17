import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
  size?: 'sm' | 'md'
  children: ReactNode
  className?: string
}

const variants = {
  default: 'bg-white/10 text-secondary',
  success: 'bg-accent-green/20 text-accent-green',
  warning: 'bg-accent-yellow/20 text-accent-yellow',
  danger: 'bg-accent-red/20 text-accent-red',
  info: 'bg-accent-blue/20 text-accent-blue',
  purple: 'bg-accent-purple/20 text-accent-purple',
}

const sizes = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
}

export function Badge({ variant = 'default', size = 'sm', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold uppercase tracking-wide rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  )
}
