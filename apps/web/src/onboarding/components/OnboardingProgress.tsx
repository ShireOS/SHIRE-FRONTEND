import { motion } from 'framer-motion'
import type { OnboardingStep } from './OnboardingLayout'

interface OnboardingProgressProps {
  currentStep: number
  steps: OnboardingStep[]
}

export function OnboardingProgress({ currentStep, steps }: OnboardingProgressProps) {
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="w-full">
      {/* Editorial progress bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="label-mono text-[rgb(var(--gold))]">
          STEP {String(currentStep + 1).padStart(2, '0')} OF {String(steps.length).padStart(2, '0')}
        </span>
        <span className="auth-display text-sm text-[rgb(var(--text-primary))]">
          {steps[currentStep]?.title}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, rgb(var(--gold)), rgba(201, 169, 98, 0.8))',
            boxShadow: '0 0 8px rgba(201, 169, 98, 0.3)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}
