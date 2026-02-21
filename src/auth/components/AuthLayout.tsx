import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
      {/* Ambient glow */}
      <div className="ambient-glow" />
      {/* Noise overlay */}
      <div className="noise-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="auth-display text-4xl text-[rgb(var(--text-primary))]">SHIRE</h1>
          <p className="label-mono text-[rgb(var(--gold))] mt-2 tracking-[0.15em]">RESTAURANT INTELLIGENCE</p>
        </div>

        {/* Glass card */}
        <div className="glass-panel rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="auth-display text-2xl text-[rgb(var(--text-primary))]">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-[rgb(var(--text-secondary))] text-sm">{subtitle}</p>
            )}
          </div>

          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-[rgb(var(--text-tertiary))] text-xs mt-6">
          Protected by enterprise-grade encryption
        </p>
      </motion.div>
    </div>
  )
}
