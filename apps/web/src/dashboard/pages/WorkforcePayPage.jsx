import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Banknote, ChartNoAxesCombined, Clock, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../../auth'
import { backOfficeApi } from '../../shared/api/backOfficeApi'
import { useBackOfficeAccess } from '../../shared/hooks/useBackOfficeAccess'
import { queryClient, queryKeys } from '../../shared/query'
import LaborCostPage from './LaborCostPage'
import TimeClockPage from './TimeClockPage'
import TipPoolingPage from './TipPoolingPage'
import {
  resolveWorkforcePayHash,
  workforcePayArea,
  workforcePayAvailability,
} from './workforcePayNavigation'

const TOP_TABS = [
  { id: 'overview', hash: 'overview', label: 'Overview', icon: ChartNoAxesCombined },
  { id: 'timecards', hash: 'timecards', label: 'Timecards', icon: Clock },
  { id: 'runs', hash: 'run', label: 'Pay Runs', icon: Banknote },
  { id: 'settings', hash: 'rules', label: 'Rules & Settings', icon: SlidersHorizontal },
]

export default function WorkforcePayPage({ restaurantId }) {
  const auth = useAuth()
  const access = useBackOfficeAccess(auth, restaurantId)
  const location = useLocation()
  const navigate = useNavigate()
  const requestedHash = (location.hash || '').replace(/^#/, '')
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState('')

  const availability = useMemo(() => workforcePayAvailability({
    canViewTeam: access.can('team.view'),
    canViewPayroll: access.can('payroll.view'),
    payrollOverviewVisible: access.viewVisible('payroll.overview'),
    laborOverviewVisible: access.viewVisible('labor.overview'),
    timecardEntriesVisible: access.viewVisible('time_clock.entries'),
    timecardAdjustmentsVisible: access.viewVisible('time_clock.adjustments'),
    timecardTotalsVisible: access.viewVisible('time_clock.totals'),
    runsVisible: access.viewVisible('payroll.runs'),
    rulesVisible: access.viewVisible('payroll.rules'),
    payrollSetupVisible: access.viewVisible('payroll.setup'),
  }), [access])

  const activeHash = resolveWorkforcePayHash(requestedHash, availability)
  const activeArea = activeHash ? workforcePayArea(activeHash) : null
  const visibleTabs = TOP_TABS.filter((tab) => (
    tab.id === 'settings'
      ? availability.rules || availability.payroll
      : availability[tab.id]
  ))

  if (access.loading) {
    return (
      <section aria-busy="true" className="rounded-2xl border border-dash-border bg-dash-panel p-5 text-sm text-dash-secondary">
        Loading Workforce &amp; Pay…
      </section>
    )
  }

  if (!activeHash) {
    const revealCapabilities = access.can('payroll.view')
      ? ['nav.tip-pooling', 'payroll.overview']
      : access.can('team.view')
        ? ['nav.time-clock', 'time_clock.entries']
        : []

    const showInMyView = async () => {
      if (!revealCapabilities.length || revealing) return
      setRevealing(true)
      setRevealError('')
      try {
        await backOfficeApi.updateMyViewPolicy(restaurantId, {
          ...access.viewPolicy,
          overrides: {
            ...access.viewPolicy.overrides,
            ...Object.fromEntries(revealCapabilities.map((capability) => [capability, 'standard'])),
          },
        })
        await queryClient.invalidateQueries({ queryKey: queryKeys.backOfficeAccess(restaurantId) })
      } catch (error) {
        setRevealError(error?.message || 'Could not update your Back Office view')
      } finally {
        setRevealing(false)
      }
    }

    return (
      <section className="rounded-2xl border border-dash-border bg-dash-panel p-8 text-center">
        <p className="label-mono">Team</p>
        <h1 className="mt-2 text-2xl font-semibold text-dash-cream">Workforce &amp; Pay</h1>
        <p className="mt-2 text-sm text-dash-secondary">No Workforce &amp; Pay sections are available in your current access and view settings.</p>
        {revealCapabilities.length ? (
          <button
            type="button"
            onClick={() => void showInMyView()}
            disabled={revealing}
            className="mt-5 rounded-lg bg-shell-cta px-4 py-2 text-sm font-semibold text-shell-cta-text disabled:opacity-50"
          >
            {revealing ? 'Updating view…' : 'Show in my view'}
          </button>
        ) : null}
        {revealError ? <p className="mt-3 text-sm text-red-300">{revealError}</p> : null}
      </section>
    )
  }

  if (requestedHash !== activeHash) {
    return (
      <Navigate
        to={{ pathname: location.pathname, search: location.search, hash: `#${activeHash}` }}
        replace
      />
    )
  }

  const goTo = (hash) => navigate({ pathname: location.pathname, search: location.search, hash: `#${hash}` })
  const showPayrollOverview = activeArea === 'overview' && availability.overview && access.viewVisible('payroll.overview')
  const showLaborOverview = activeArea === 'overview' && availability.overview && access.viewVisible('labor.overview')
  const showTipPooling = showPayrollOverview || activeArea === 'runs' || activeArea === 'settings'

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-sm">
        <p className="label-mono text-dash-tertiary">Team</p>
        <h1 className="mt-1 text-2xl font-semibold text-dash-cream">Workforce &amp; Pay</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-dash-secondary">
          Review labor, correct timecards, run payroll, and manage tip and pay rules from one workspace.
        </p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Workforce and pay sections">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const active = activeArea === tab.id
            const targetHash = tab.id === 'settings'
              ? (availability.rules ? 'rules' : 'payroll')
              : tab.hash
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => goTo(targetHash)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-shell-accent/60 bg-shell-accent/15 text-dash-cream'
                    : 'border-dash-border text-dash-secondary hover:border-shell-accent/40 hover:text-dash-cream'
                }`}
              >
                <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {activeArea === 'settings' && availability.rules && availability.payroll ? (
          <nav className="mt-3 flex flex-wrap gap-2 border-t border-dash-border pt-3" aria-label="Rules and settings sections">
            <button type="button" onClick={() => goTo('rules')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeHash === 'rules' ? 'bg-dash-gold/15 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'}`}>Tip &amp; Tipout Rules</button>
            <button type="button" onClick={() => goTo('payroll')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeHash === 'payroll' ? 'bg-dash-gold/15 text-dash-gold' : 'text-dash-secondary hover:text-dash-cream'}`}>Payroll Setup</button>
          </nav>
        ) : null}
      </section>

      {activeArea === 'timecards' ? <TimeClockPage restaurantId={restaurantId} /> : null}
      {showTipPooling ? <TipPoolingPage restaurantId={restaurantId} /> : null}
      {showLaborOverview ? <LaborCostPage restaurantId={restaurantId} /> : null}
    </div>
  )
}
