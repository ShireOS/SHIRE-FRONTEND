import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { DemoFloorPlan } from '../../components/DemoFloorPlan'
import { DemoSchedule } from '../../components/DemoSchedule'
import { DemoAnalytics } from '../../components/DemoAnalytics'

interface DemoShowcaseProps {
  onboarding: UseOnboardingReturn
}

const TABS = [
  { id: 'floor', label: 'Floor Intelligence' },
  { id: 'schedule', label: 'Staff & Scheduling' },
  { id: 'analytics', label: 'Performance Analytics' },
]

const AUTO_ADVANCE_DURATION = 6000

export function DemoShowcase({ onboarding }: DemoShowcaseProps) {
  const { data, nextStep } = onboarding
  const [activeTab, setActiveTab] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const restaurantName = data.name || 'Your Restaurant'

  const advanceTab = useCallback(() => {
    setActiveTab(prev => (prev + 1) % TABS.length)
    setProgress(0)
  }, [])

  // Auto-advance timer
  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          advanceTab()
          return 0
        }
        return prev + (100 / (AUTO_ADVANCE_DURATION / 50))
      })
    }, 50)

    return () => clearInterval(interval)
  }, [isPaused, advanceTab])

  const handleTabClick = (index: number) => {
    setActiveTab(index)
    setProgress(0)
    setIsPaused(true)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h3 className="auth-display text-xl text-[rgb(var(--text-primary))]">
          This is what <span className="text-[rgb(var(--gold))]">{restaurantName}</span> will look like
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[rgba(255,255,255,0.03)] rounded-xl p-1 border border-[rgba(255,255,255,0.06)]">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(index)}
            className={`relative flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all overflow-hidden ${
              activeTab === index
                ? 'text-[rgb(var(--text-primary))]'
                : 'text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-secondary))]'
            }`}
          >
            {/* Active background */}
            {activeTab === index && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-[rgba(255,255,255,0.08)] rounded-lg"
                transition={{ duration: 0.2 }}
              />
            )}

            {/* Progress bar under active tab */}
            {activeTab === index && !isPaused && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px]">
                <div
                  className="h-full bg-[rgb(var(--gold))] transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="glass-panel rounded-xl p-6 min-h-[320px]">
        {activeTab === 0 && <DemoFloorPlan restaurantName={restaurantName} />}
        {activeTab === 1 && <DemoSchedule />}
        {activeTab === 2 && <DemoAnalytics restaurantType={data.type} />}
      </div>

      {/* Social proof */}
      <div className="text-center">
        <p className="text-[rgb(var(--text-tertiary))] text-sm">
          Trusted by <span className="text-[rgb(var(--text-secondary))]">500+</span> restaurants to optimize operations daily
        </p>
      </div>

      {/* Continue CTA */}
      <button
        onClick={nextStep}
        className="w-full py-4 px-6 bg-white text-black hover:bg-gray-100 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        Continue Setup
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
