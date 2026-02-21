import { AnimatePresence, motion } from 'framer-motion'
import { useRequireOnboarding } from '../../auth'
import { useOnboarding } from '../hooks/useOnboarding'
import { OnboardingLayout, ONBOARDING_STEPS } from '../components/OnboardingLayout'
import { LaunchScreen } from '../components/LaunchScreen'
import { BasicsStep } from './steps/BasicsStep'
import { GoalsStep } from './steps/GoalsStep'
import { DemoShowcase } from './steps/DemoShowcase'
import { TechStackStep } from './steps/TechStackStep'
import { HoursStep } from './steps/HoursStep'
import { CapacityStep } from './steps/CapacityStep'
import { MenuStep } from './steps/MenuStep'
import { TeamStep } from './steps/TeamStep'

export function OnboardingPage() {
  const { isReady } = useRequireOnboarding()
  const onboarding = useOnboarding()

  const { currentStep, nextStep, prevStep, showLaunchScreen } = onboarding

  // Loading state
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#d4a854] mx-auto mb-4" />
          <p className="text-[rgb(var(--text-tertiary))]">Loading...</p>
        </div>
      </div>
    )
  }

  // Show launch celebration
  if (showLaunchScreen) {
    return <LaunchScreen onboarding={onboarding} />
  }

  // Get current step config
  const step = ONBOARDING_STEPS[currentStep]

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicsStep onboarding={onboarding} />
      case 1:
        return <GoalsStep onboarding={onboarding} />
      case 2:
        return <DemoShowcase onboarding={onboarding} />
      case 3:
        return <TechStackStep onboarding={onboarding} />
      case 4:
        return <HoursStep onboarding={onboarding} />
      case 5:
        return <CapacityStep onboarding={onboarding} />
      case 6:
        return <MenuStep onboarding={onboarding} />
      case 7:
        return <TeamStep onboarding={onboarding} />
      default:
        return null
    }
  }

  // Steps 3-6 are skippable (tools, hours, capacity, menu). Demo (2) shows only Continue.
  const canSkip = currentStep >= 3 && currentStep <= 6
  const canGoBack = currentStep > 0

  return (
    <OnboardingLayout
      currentStep={currentStep}
      title={step?.title || 'Setup'}
      subtitle={step?.description}
      canSkip={canSkip}
      onSkip={nextStep}
      canGoBack={canGoBack}
      onBack={prevStep}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </OnboardingLayout>
  )
}
