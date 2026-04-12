import { useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'

interface GoalsStepProps {
  onboarding: UseOnboardingReturn
}

const CHALLENGES = [
  { id: 'table_turnover', label: 'Table Turnover', description: 'Guests staying too long or tables sitting empty' },
  { id: 'floor_visibility', label: 'Floor Visibility', description: 'Hard to see what\'s happening across the floor' },
  { id: 'scheduling', label: 'Scheduling', description: 'Building fair schedules takes too long' },
  { id: 'performance_data', label: 'Performance Data', description: 'No real-time data on revenue or operations' },
  { id: 'waitlist', label: 'Waitlist Management', description: 'Long waits and unhappy guests' },
  { id: 'communication', label: 'Team Communication', description: 'Miscommunication between FOH and BOH' },
]

const COVERS_OPTIONS = [
  { value: 'under_50', label: 'Under 50' },
  { value: '50_150', label: '50 - 150' },
  { value: '150_300', label: '150 - 300' },
  { value: '300_plus', label: '300+' },
]

const TEAM_SIZE_OPTIONS = [
  { value: '1_5', label: '1 - 5' },
  { value: '6_15', label: '6 - 15' },
  { value: '16_30', label: '16 - 30' },
  { value: '30_plus', label: '30+' },
]

const GOALS = [
  { value: 'revenue', label: 'Increase Revenue', description: 'Optimize table turns and upselling' },
  { value: 'costs', label: 'Reduce Costs', description: 'Labor optimization and waste reduction' },
  { value: 'guest_experience', label: 'Guest Experience', description: 'Faster service and happier guests' },
  { value: 'data', label: 'Better Data', description: 'Real-time insights for smarter decisions' },
  { value: 'replace_tools', label: 'Replace Current Tools', description: 'Consolidate into one platform' },
]

export function GoalsStep({ onboarding }: GoalsStepProps) {
  const { data, updateData, saveGoals, nextStep, isLoading, error } = onboarding
  const [localError, setLocalError] = useState<string | null>(null)

  const toggleChallenge = (id: string) => {
    const current = data.challenges || []
    if (current.includes(id)) {
      updateData({ challenges: current.filter(c => c !== id) })
    } else {
      updateData({ challenges: [...current, id] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    try {
      await saveGoals()
      nextStep()
    } catch {
      // Error handled by hook
    }
  }

  const displayError = localError || error

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {displayError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {displayError}
        </div>
      )}

      {/* Challenges */}
      <div>
        <label className="label-mono block mb-1 text-[rgb(var(--gold))]">
          What are your biggest challenges?
        </label>
        <p className="text-[rgb(var(--text-tertiary))] text-sm mb-4">Select all that apply</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHALLENGES.map(challenge => (
            <button
              key={challenge.id}
              type="button"
              onClick={() => toggleChallenge(challenge.id)}
              className={`p-4 rounded-lg border text-left transition-all ${
                data.challenges.includes(challenge.id)
                  ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)] shadow-[0_0_12px_rgba(201,169,98,0.1)]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              <span className="block text-[rgb(var(--text-primary))] font-medium text-sm">{challenge.label}</span>
              <span className="block text-[rgb(var(--text-tertiary))] text-xs mt-1">{challenge.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Covers */}
      <div>
        <label className="label-mono block mb-4 text-[rgb(var(--gold))]">
          How many covers per day?
        </label>
        <div className="flex flex-wrap gap-3">
          {COVERS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateData({ daily_covers_range: opt.value })}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                data.daily_covers_range === opt.value
                  ? 'bg-white text-black'
                  : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team Size */}
      <div>
        <label className="label-mono block mb-4 text-[rgb(var(--gold))]">
          How many staff members?
        </label>
        <div className="flex flex-wrap gap-3">
          {TEAM_SIZE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateData({ team_size_range: opt.value })}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                data.team_size_range === opt.value
                  ? 'bg-white text-black'
                  : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Goal */}
      <div>
        <label className="label-mono block mb-1 text-[rgb(var(--gold))]">
          #1 goal with SHIRE?
        </label>
        <p className="text-[rgb(var(--text-tertiary))] text-sm mb-4">Pick one</p>
        <div className="space-y-3">
          {GOALS.map(goal => (
            <button
              key={goal.value}
              type="button"
              onClick={() => updateData({ primary_goal: goal.value })}
              className={`w-full p-4 rounded-lg border text-left transition-all flex items-center gap-4 ${
                data.primary_goal === goal.value
                  ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                data.primary_goal === goal.value
                  ? 'border-[rgb(var(--gold))]'
                  : 'border-[rgba(255,255,255,0.2)]'
              }`}>
                {data.primary_goal === goal.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--gold))]" />
                )}
              </div>
              <div>
                <span className="block text-[rgb(var(--text-primary))] font-medium text-sm">{goal.label}</span>
                <span className="block text-[rgb(var(--text-tertiary))] text-xs mt-0.5">{goal.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 px-6 bg-white text-black hover:bg-gray-100 disabled:opacity-50 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#d4a854]" />
            Saving...
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  )
}
