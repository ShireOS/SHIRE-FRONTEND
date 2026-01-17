import { cn } from '../../lib/cn'
import { motion } from 'framer-motion'
import type { ReactNode, MouseEventHandler } from 'react'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'warning' | 'danger' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
}

const variants = {
  primary: 'bg-accent-blue hover:bg-accent-blue/90 text-white shadow-lg shadow-accent-blue/20',
  secondary: 'bg-white/[0.03] hover:bg-gold/10 text-secondary hover:text-gold border border-white/[0.08] hover:border-gold/40',
  ghost: 'bg-transparent hover:bg-gold/10 text-secondary hover:text-gold',
  success: 'bg-accent-green hover:bg-accent-green/90 text-white shadow-lg shadow-accent-green/20',
  warning: 'bg-accent-yellow hover:bg-accent-yellow/90 text-black',
  danger: 'bg-accent-red hover:bg-accent-red/90 text-white shadow-lg shadow-accent-red/20',
  gold: 'bg-gold hover:bg-gold/90 text-black font-semibold',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  type = 'button',
  onClick,
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-base',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </motion.button>
  )
}
