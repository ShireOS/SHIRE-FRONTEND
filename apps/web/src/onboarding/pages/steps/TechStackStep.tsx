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

const SERVICE_MODE_OPTIONS = [
  { id: 'dine_in', label: 'Dine-in' },
  { id: 'bar', label: 'Bar service' },
  { id: 'counter_service', label: 'Counter service' },
  { id: 'takeout', label: 'Takeout' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'catering', label: 'Catering' },
]

const GUEST_FLOW_OPTIONS = [
  { id: 'seat_first', label: 'Seat first', description: 'Host seats guests, then orders are attached to a table.' },
  { id: 'order_first', label: 'Order first', description: 'Guests order before a table is assigned.' },
  { id: 'tab_first', label: 'Tab first', description: 'Open a named or card-backed tab before ordering.' },
  { id: 'counter_pay', label: 'Counter pay', description: 'Guests pay at the counter before or after pickup.' },
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

  const toggleServiceMode = (id: string) => {
    const current = data.service_modes || []
    updateData({
      service_modes: current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id],
    })
  }

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

      <div>
        <label className="label-mono block mb-4 text-[rgb(var(--gold))]">
          Service Modes
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SERVICE_MODE_OPTIONS.map(opt => {
            const selected = data.service_modes?.includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleServiceMode(opt.id)}
                className={`p-4 rounded-lg border text-center transition-all ${
                  selected
                    ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)] shadow-[0_0_12px_rgba(201,169,98,0.1)]'
                    : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
                }`}
              >
                <span className={`text-sm font-medium ${selected ? 'text-[rgb(var(--text-primary))]' : 'text-[rgb(var(--text-secondary))]'}`}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="label-mono block mb-4 text-[rgb(var(--gold))]">
          Default Guest Flow
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {GUEST_FLOW_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => updateData({ default_guest_flow: opt.id })}
              className={`p-4 rounded-lg border text-left transition-all ${
                data.default_guest_flow === opt.id
                  ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)] shadow-[0_0_12px_rgba(201,169,98,0.1)]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              <span className="block text-sm font-semibold text-[rgb(var(--text-primary))]">{opt.label}</span>
              <span className="mt-2 block text-sm leading-5 text-[rgb(var(--text-secondary))]">{opt.description}</span>
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
