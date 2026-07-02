import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth, useRequireOnboarding } from '../../auth'
import { useOnboarding } from '../hooks/useOnboarding'
import { OnboardingLayout, ONBOARDING_STEPS } from '../components/OnboardingLayout'
import { LaunchScreen } from '../components/LaunchScreen'
import { BasicsStep } from './steps/BasicsStep'
import { LegalStep } from './steps/LegalStep'
import { PaymentsStep } from './steps/PaymentsStep'
import { TaxesChargesStep } from './steps/TaxesChargesStep'
import { DiscountRulesStep } from './steps/DiscountRulesStep'
import { ManagerControlsStep } from './steps/ManagerControlsStep'
import { CloseoutSettingsStep } from './steps/CloseoutSettingsStep'
import { CheckWorkflowStep } from './steps/CheckWorkflowStep'
import { TipPayrollStep } from './steps/TipPayrollStep'
import { GoalsStep } from './steps/GoalsStep'
import { DemoShowcase } from './steps/DemoShowcase'
import { TechStackStep } from './steps/TechStackStep'
import { SectionsStep } from './steps/SectionsStep'
import { HoursStep } from './steps/HoursStep'
import { ReservationTimingStep } from './steps/ReservationTimingStep'
import { CapacityStep } from './steps/CapacityStep'
import { MenuCategoriesStep } from './steps/MenuCategoriesStep'
import { MenuStep } from './steps/MenuStep'
import { ModifierStep } from './steps/ModifierStep'
import { RoutingStep } from './steps/RoutingStep'
import { TeamStep } from './steps/TeamStep'

export function OnboardingPage() {
  const { isReady } = useRequireOnboarding()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false)
  const [switchAccountError, setSwitchAccountError] = useState<string | null>(null)

  const { currentStep, nextStep, prevStep, showLaunchScreen, isHydrating } = onboarding

  const handleSwitchAccount = useCallback(async () => {
    setSwitchAccountError(null)
    setIsSwitchingAccount(true)

    try {
      await signOut()
      navigate('/auth/login', {
        replace: true,
        state: { switchedAccount: true },
      })
    } catch {
      setSwitchAccountError('Unable to sign out. Please try again.')
    } finally {
      setIsSwitchingAccount(false)
    }
  }, [navigate, signOut])

  // Loading state
  if (!isReady || isHydrating) {
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
    return (
      <LaunchScreen
        onboarding={onboarding}
        onSwitchAccount={handleSwitchAccount}
        isSwitchingAccount={isSwitchingAccount}
        switchAccountError={switchAccountError}
      />
    )
  }

  // Get current step config
  const step = ONBOARDING_STEPS[currentStep]

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicsStep onboarding={onboarding} />
      case 1:
        return <LegalStep onboarding={onboarding} />
      case 2:
        return <PaymentsStep onboarding={onboarding} />
      case 3:
        return <TaxesChargesStep onboarding={onboarding} />
      case 4:
        return <DiscountRulesStep onboarding={onboarding} />
      case 5:
        return <ManagerControlsStep onboarding={onboarding} />
      case 6:
        return <CloseoutSettingsStep onboarding={onboarding} />
      case 7:
        return <CheckWorkflowStep onboarding={onboarding} />
      case 8:
        return <TipPayrollStep onboarding={onboarding} />
      case 9:
        return <GoalsStep onboarding={onboarding} />
      case 10:
        return <DemoShowcase onboarding={onboarding} />
      case 11:
        return <TechStackStep onboarding={onboarding} />
      case 12:
        return <SectionsStep onboarding={onboarding} />
      case 13:
        return <HoursStep onboarding={onboarding} />
      case 14:
        return <ReservationTimingStep onboarding={onboarding} />
      case 15:
        return <CapacityStep onboarding={onboarding} />
      case 16:
        return <MenuCategoriesStep onboarding={onboarding} />
      case 17:
        return <MenuStep onboarding={onboarding} />
      case 18:
        return <ModifierStep onboarding={onboarding} />
      case 19:
        return <RoutingStep onboarding={onboarding} />
      case 20:
        return <TeamStep onboarding={onboarding} />
      default:
        return null
    }
  }

  // Optional setup steps can be skipped; required basics are enforced in the step UI.
  const canSkip = currentStep >= 4 && currentStep <= 18
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
      onSwitchAccount={handleSwitchAccount}
      isSwitchingAccount={isSwitchingAccount}
      switchAccountError={switchAccountError}
    >
      <AnimatePresence mode="wait" initial={false}>
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
