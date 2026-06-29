import { useEffect, type ReactNode } from 'react'
import { OnboardingProgress } from './OnboardingProgress'

export interface OnboardingStep {
  id: string
  title: string
  description: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'basics', title: 'Restaurant Basics', description: 'Name, location, and type' },
  { id: 'legal', title: 'Business & Legal', description: 'Legal entity, signer, and agreement' },
  { id: 'payments', title: 'Payments & Payouts', description: 'Bank account and processing defaults' },
  { id: 'taxes_charges', title: 'Taxes & Charges', description: 'Tax categories, service fees, and gratuity defaults' },
  { id: 'discounts', title: 'Discounts & Comps', description: 'Promos, employee meals, comps, and role access' },
  { id: 'manager_controls', title: 'Manager Controls', description: 'Role permissions, approvals, and limits' },
  { id: 'closeout', title: 'Cash & Closeout', description: 'Cash drawers, server checkout, and end-of-day close' },
  { id: 'check_workflow', title: 'Check Workflow', description: 'Split checks, tabs, preauth, transfers, and fire rules' },
  { id: 'tips_payroll', title: 'Tips & Payroll', description: 'Tip pooling, tipout rules, wages, and payroll exports' },
  { id: 'goals', title: 'Goals & Priorities', description: 'What matters most to you' },
  { id: 'demo', title: 'Your Dashboard Preview', description: 'See what SHIRE can do' },
  { id: 'tools', title: 'Tools & Service Model', description: 'Your existing tech stack and guest flow' },
  { id: 'sections', title: 'Sections & Areas', description: 'Bar, patio, outdoor, and dining-room categories' },
  { id: 'hours', title: 'Operating Hours', description: 'When you\'re open' },
  { id: 'capacity', title: 'Tables & Capacity', description: 'Your floor layout' },
  { id: 'menu_categories', title: 'Menu Categories & Routing', description: 'Apps, entrees, desserts, tax overrides, and station defaults' },
  { id: 'menu', title: 'Menu Setup', description: 'Import your menu' },
  { id: 'modifiers', title: 'Menu Modifiers', description: 'Add-ons and customizations' },
  { id: 'routing', title: 'Kitchen Routing', description: 'Stations, targets, and fallback' },
  { id: 'team', title: 'Add Your Staff', description: 'So waiters can log into the POS' },
]

interface OnboardingLayoutProps {
  children: ReactNode
  currentStep: number
  title: string
  subtitle?: string
  canSkip?: boolean
  onSkip?: () => void
  canGoBack?: boolean
  onBack?: () => void
  onSwitchAccount?: () => void
  isSwitchingAccount?: boolean
  switchAccountError?: string | null
}

export function OnboardingLayout({
  children,
  currentStep,
  title,
  subtitle,
  canSkip,
  onSkip,
  canGoBack,
  onBack,
  onSwitchAccount,
  isSwitchingAccount = false,
  switchAccountError,
}: OnboardingLayoutProps) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('dark')
    root.classList.remove('light')
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.8)] backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {canGoBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--gold))] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="auth-display text-xl text-[rgb(var(--text-primary))]">SHIRE</h1>
              <p className="label-mono text-[rgb(var(--gold))] tracking-[0.15em]">RESTAURANT SETUP</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {onSwitchAccount && (
              <button
                onClick={onSwitchAccount}
                disabled={isSwitchingAccount}
                className="label-mono text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-primary))] disabled:opacity-60 disabled:cursor-not-allowed transition-colors tracking-[0.1em]"
              >
                {isSwitchingAccount ? 'SIGNING OUT...' : 'SWITCH ACCOUNT'}
              </button>
            )}
            {canSkip && (
              <button
                onClick={onSkip}
                className="label-mono text-[rgb(var(--gold))] hover:text-[rgb(var(--text-primary))] transition-colors tracking-[0.1em]"
              >
                SKIP FOR NOW
              </button>
            )}
          </div>
        </div>
        {switchAccountError && (
          <div className="max-w-4xl mx-auto px-4 pb-3">
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {switchAccountError}
            </div>
          </div>
        )}
      </header>

      {/* Progress */}
      <div className="max-w-4xl mx-auto px-4 py-6 relative z-10">
        <OnboardingProgress currentStep={currentStep} steps={ONBOARDING_STEPS} />
      </div>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 pb-12 relative z-10">
        <div className="mb-8">
          <h2 className="auth-display text-2xl text-[rgb(var(--text-primary))]">{title}</h2>
          {subtitle && (
            <p className="mt-2 text-[rgb(var(--text-secondary))] text-sm">{subtitle}</p>
          )}
        </div>

        {children}
      </main>
    </div>
  )
}
