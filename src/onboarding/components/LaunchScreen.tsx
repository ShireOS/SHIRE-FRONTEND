import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { UseOnboardingReturn } from '../hooks/useOnboarding'

interface LaunchScreenProps {
  onboarding: UseOnboardingReturn
}

export function LaunchScreen({ onboarding }: LaunchScreenProps) {
  const { data, goToDashboard } = onboarding
  const [showButton, setShowButton] = useState(false)

  const restaurantName = data.name || 'Your Restaurant'

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
      {/* Gold radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 50% 40% at 50% 45%, rgba(201, 169, 98, 0.12) 0%, transparent 70%)',
        }}
      />
      <div className="noise-overlay" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 text-center px-4"
      >
        {/* Animated checkmark circle */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-8 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(201, 169, 98, 0.2), rgba(201, 169, 98, 0.05))',
            border: '2px solid rgb(var(--gold))',
            boxShadow: '0 0 40px rgba(201, 169, 98, 0.2)',
          }}
        >
          <motion.svg
            className="w-10 h-10 text-[rgb(var(--gold))]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            />
          </motion.svg>
        </motion.div>

        {/* Restaurant name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="auth-display text-3xl sm:text-4xl text-[rgb(var(--text-primary))] mb-3"
        >
          {restaurantName} is live
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="label-mono text-[rgb(var(--gold))] tracking-[0.15em] mb-10"
        >
          YOUR DASHBOARD IS READY
        </motion.p>

        {/* Go to Dashboard button */}
        {showButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onClick={goToDashboard}
            className="px-8 py-3 bg-white text-black hover:bg-gray-100 font-medium rounded-lg transition-colors text-sm"
          >
            Go to Dashboard
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}
