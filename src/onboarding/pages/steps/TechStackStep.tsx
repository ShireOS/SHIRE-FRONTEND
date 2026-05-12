import type { UseOnboardingReturn } from '../../hooks/useOnboarding'

interface TechStackStepProps {
  onboarding: UseOnboardingReturn
}

const POS_OPTIONS = [
  { id: 'toast', label: 'Toast' },
  { id: 'square', label: 'Square' },
  { id: 'clover', label: 'Clover' },
  { id: 'lightspeed', label: 'Lightspeed' },
  { id: 'other', label: 'Other' },
  { id: 'none', label: 'None' },
]

const SCHEDULING_OPTIONS = [
  { id: '7shifts', label: '7shifts' },
  { id: 'hotschedules', label: 'HotSchedules' },
  { id: 'wheniwork', label: 'When I Work' },
  { id: 'deputy', label: 'Deputy' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'none', label: 'None' },
]

const RESERVATION_OPTIONS = [
  { id: 'opentable', label: 'OpenTable' },
  { id: 'resy', label: 'Resy' },
  { id: 'yelp', label: 'Yelp' },
  { id: 'walkins', label: 'Walk-ins Only' },
  { id: 'other', label: 'Other' },
]

export function TechStackStep({ onboarding }: TechStackStepProps) {
  const { data, updateData, saveTechStack, nextStep, isLoading, error } = onboarding

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await saveTechStack()
      nextStep()
    } catch {
      // Error handled by hook
    }
  }

  const renderCardGrid = (
    options: { id: string; label: string }[],
    selected: string | null,
    onChange: (id: string) => void
  ) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`p-4 rounded-lg border text-center transition-all ${
            selected === opt.id
              ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)] shadow-[0_0_12px_rgba(201,169,98,0.1)]'
              : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
          }`}
        >
          <span className={`text-sm font-medium ${
            selected === opt.id ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-secondary))]'
          }`}>
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Current POS */}
      <div>
        <label className="label-mono block mb-4 text-[rgb(var(--gold))]">
          Current POS System <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>
        {renderCardGrid(
          POS_OPTIONS,
          data.current_pos,
          (id) => updateData({ current_pos: id })
        )}
      </div>

      {/* Scheduling Tool */}
      <div>
        <label className="label-mono block mb-4 text-[rgb(var(--gold))]">
          Scheduling Tool <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>
        {renderCardGrid(
          SCHEDULING_OPTIONS,
          data.current_scheduling,
          (id) => updateData({ current_scheduling: id })
        )}
      </div>

      {/* Reservation System */}
      <div>
        <label className="label-mono block mb-4 text-[rgb(var(--gold))]">
          Reservation System <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>
        {renderCardGrid(
          RESERVATION_OPTIONS,
          data.current_reservations,
          (id) => updateData({ current_reservations: id })
        )}
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
