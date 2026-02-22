import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const bgOptions = [
    { id: 'abstract', dark: '/auth-dark.png', light: '/auth-light.png' },
    { id: 'ring', dark: '/auth-ring-dark.png', light: '/auth-ring-light.png' },
    { id: 'restaurant', dark: '/auth-rest-dark.png', light: '/auth-rest-light.png' },
  ]
  const [bgIndex, setBgIndex] = useState(2)

  // Check system preference or local storage for initial theme
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('auth-theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return true
  })

  // Apply theme class to document element
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
    <div className="min-h-screen bg-base flex transition-colors duration-500 font-sans">

      {/* Absolute top-right toggle across the whole screen */}
      <div className="absolute top-8 right-8 z-50">
        <button
          onClick={() => setIsDark(!isDark)}
          className="w-16 h-8 rounded-full bg-elevated/80 backdrop-blur-md border border-transparent shadow-sm hover:shadow transition-all relative flex items-center px-1 cursor-pointer focus:outline-none"
          aria-label="Toggle Dark Mode"
        >
          {/* Icons container */}
          <div className="absolute w-full flex justify-between px-2 left-0 text-primary/50 pointer-events-none">
            {/* Moon icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
            </svg>
            {/* Sun icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 1.536a1 1 0 011.415 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zm-1.536 4.22a1 1 0 010 1.415l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 18a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zm-4.22-1.536a1 1 0 01-1.415 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm1.536-4.22a1 1 0 010-1.415l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414 0zM10 5a5 5 0 100 10 5 5 0 000-10z"></path>
            </svg>
          </div>

          {/* Animated Thumb */}
          <motion.div
            className="w-6 h-6 rounded-full bg-primary shadow-sm relative z-10"
            animate={{ x: isDark ? 0 : 32 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* LEFT COLUMN: Form Area */}
      <div className="w-full lg:w-1/2 flex flex-col relative z-10 px-8 py-10 lg:px-24 justify-center">

        {/* Top Header - Logo */}
        <div className="absolute top-8 left-8 lg:left-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-base">
                <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-display text-2xl tracking-wide text-primary">SHIRE</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md mx-auto mt-20"
        >
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-semibold tracking-tight text-primary mb-3">
              {title}
            </h1>
            {subtitle && (
              <p className="text-lg text-secondary">
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </motion.div>
      </div>

      {/* RIGHT COLUMN: Visual/Marketing Area */}
      <div className="hidden lg:flex w-1/2 bg-surface relative overflow-hidden items-center justify-center p-8">
        {/* Decorative inner container */}
        <div className="w-full max-w-3xl h-[85vh] rounded-3xl overflow-hidden relative shadow-2xl glass-card backdrop-blur-2xl group border border-white/5">
          <img
            src={isDark ? '/auth-rest-dark.png' : '/auth-rest-light.png'}
            alt="Shire Marketing"
            className="w-full h-full object-cover transition-opacity duration-700"
            key={isDark ? 'dark-restaurant' : 'light-restaurant'}
          />

          {/* Gradient Overlay for Text Legibility if needed */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Testimonial / Features Overlay */}
          <div className="absolute bottom-12 left-12 right-12 z-10 glass-panel rounded-2xl p-6 border border-white/10 mt-auto bg-black/40 backdrop-blur-xl">
            <div className="flex gap-4 mb-4">
              <span className="px-3 py-1 rounded-full border border-white/20 text-white/90 text-xs font-mono backdrop-blur-md">Restaurant Intelligence</span>
            </div>
            <p className="text-white text-lg font-medium leading-relaxed mb-4">
              "Shire is exactly the solution we've been looking for. It has completely streamlined our operations at Mimosas, making scheduling and staffing essentially run themselves. It's a game changer."
            </p>
            <div>
              <p className="text-white/90 text-sm font-semibold tracking-wide">Genta T</p>
              <p className="text-white/60 text-xs mt-1 font-medium">Co-Owner @ Mimosas</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
