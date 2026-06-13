import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('auth-theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return true
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      root.classList.remove('light')
      localStorage.setItem('auth-theme', 'dark')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
      localStorage.setItem('auth-theme', 'light')
    }
  }, [isDark])

  return (
    <div className="min-h-screen bg-dash-base text-dash-cream transition-colors duration-500 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(201,169,98,0.12),transparent_26%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.06),transparent_24%)]" />

      <div className="absolute top-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          className="w-14 h-8 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-sm transition-all relative flex items-center px-1 cursor-pointer focus:outline-none"
          aria-label="Toggle Dark Mode"
        >
          <div className="absolute w-full flex justify-between px-2 left-0 text-dash-secondary pointer-events-none">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 1.536a1 1 0 011.415 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zm-1.536 4.22a1 1 0 010 1.415l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 18a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zm-4.22-1.536a1 1 0 01-1.415 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm1.536-4.22a1 1 0 010-1.415l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414 0zM10 5a5 5 0 100 10 5 5 0 000-10z" />
            </svg>
          </div>
          <motion.div
            className="w-6 h-6 rounded-full bg-dash-gold shadow-sm relative z-10"
            animate={{ x: isDark ? 0 : 24 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl backdrop-blur-xl lg:grid-cols-[1fr_420px]"
        >
          <section className="p-6 sm:p-10">
            <div className="mb-10">
              <p className="label-mono text-dash-gold">SHIRE Owner Console</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-dash-cream sm:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-3 max-w-md text-sm leading-6 text-dash-secondary">
                  {subtitle}
                </p>
              )}
            </div>
            {children}
          </section>

          <aside className="hidden border-l border-white/10 bg-black/20 p-8 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex rounded-xl border border-dash-gold/25 bg-dash-gold/10 px-3 py-2 text-xs font-semibold text-dash-gold">
                Manager / Owner Access
              </div>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                Operations, analytics, setup, and scheduling in one place.
              </h2>
              <p className="mt-4 text-sm leading-6 text-dash-secondary">
                Sign in to manage restaurants, edit setup, review analytics, and prepare staff scheduling workflows.
              </p>
            </div>

            <div className="flex flex-1 items-center justify-center py-10">
              <div className="relative h-44 w-44 rounded-[34px] border-2 border-dash-gold/80 bg-dash-gold/5 shadow-[0_0_80px_rgba(201,169,98,0.16)]">
                <div className="absolute left-5 top-5 h-5 w-5 border-l-2 border-t-2 border-dash-gold/90" />
                <div className="absolute right-5 top-5 h-5 w-5 border-r-2 border-t-2 border-dash-gold/90" />
                <div className="absolute bottom-5 left-5 h-5 w-5 border-b-2 border-l-2 border-dash-gold/90" />
                <div className="absolute bottom-5 right-5 h-5 w-5 border-b-2 border-r-2 border-dash-gold/90" />
                <div className="absolute left-1/2 top-1/2 h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dash-cream/85 bg-dash-cream/5" />
                <div className="absolute left-1/2 top-1/2 h-9 w-14 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dash-gold/70" />
                <div className="absolute left-1/2 top-[48px] h-9 w-px -translate-x-1/2 bg-dash-gold/60" />
                <div className="absolute left-1/2 bottom-[48px] h-9 w-px -translate-x-1/2 bg-dash-gold/60" />
              </div>
            </div>

            <div className="grid gap-3 text-sm text-dash-secondary">
              <p className="leading-6">
                Restaurant setup, analytics, and scheduling share one operational workspace after sign in.
              </p>
            </div>
          </aside>
        </motion.div>
      </main>
    </div>
  )
}
