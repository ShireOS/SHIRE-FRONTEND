import type { UseOnboardingReturn } from '../../hooks/useOnboarding'

interface ReservationTimingStepProps {
  onboarding: UseOnboardingReturn
}

type TimingField =
  | 'reservation_online_booking_horizon_days'
  | 'reservation_online_lead_time_minutes'
  | 'reservation_online_grace_period_minutes'
  | 'reservation_staff_booking_horizon_days'
  | 'reservation_staff_lead_time_minutes'
  | 'reservation_staff_grace_period_minutes'
  | 'reservation_slot_interval_minutes'
  | 'reservation_min_party_size'
  | 'reservation_max_party_size'
  | 'reservation_default_duration_minutes'

function TimingInput({
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  suffix: string
  min: number
  max: number
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="label-mono block mb-2 text-[rgb(var(--gold))]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
        />
        <span className="w-20 text-sm text-[rgb(var(--text-tertiary))]">{suffix}</span>
      </div>
    </label>
  )
}

export function ReservationTimingStep({ onboarding }: ReservationTimingStepProps) {
  const { data, updateData, saveReservationTiming, nextStep, isLoading, error } = onboarding

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveReservationTiming()
      nextStep()
    } catch {
      // Error handled by hook.
    }
  }

  const setTiming = (field: TimingField, value: string) => {
    const updates: Partial<typeof data> = { [field]: value }
    if (data.reservation_timing_same_for_channels && field.startsWith('reservation_online_')) {
      const staffField = field.replace('reservation_online_', 'reservation_staff_') as TimingField
      updates[staffField] = value
    }
    updateData(updates)
  }

  const useSameRules = data.reservation_timing_same_for_channels

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      <div className="p-5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[rgb(var(--text-primary))] font-medium">Use the same timing for every reservation channel?</h3>
            <p className="mt-1 text-sm leading-6 text-[rgb(var(--text-secondary))]">
              Online booking links and staff-created reservations start with the same rules. Split them when the host team needs more flexibility than guests booking themselves.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() =>
                updateData({
                  reservation_timing_same_for_channels: true,
                  reservation_staff_booking_horizon_days: data.reservation_online_booking_horizon_days,
                  reservation_staff_lead_time_minutes: data.reservation_online_lead_time_minutes,
                  reservation_staff_grace_period_minutes: data.reservation_online_grace_period_minutes,
                })
              }
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                useSameRules
                  ? 'bg-white text-black'
                  : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))] hover:bg-[rgba(255,255,255,0.1)]'
              }`}
            >
              Same
            </button>
            <button
              type="button"
              onClick={() => updateData({ reservation_timing_same_for_channels: false })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !useSameRules
                  ? 'bg-white text-black'
                  : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))] hover:bg-[rgba(255,255,255,0.1)]'
              }`}
            >
              Different
            </button>
          </div>
        </div>
      </div>

      <section className="p-6 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] space-y-5">
        <div>
          <p className="label-mono text-[rgb(var(--gold))] tracking-[0.12em]">SLOTS & PARTIES</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">
            These shape the bookable reservation windows hosts and guests can choose.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <TimingInput
            label="Slot spacing"
            value={data.reservation_slot_interval_minutes}
            suffix="minutes"
            min={5}
            max={180}
            onChange={(value) => setTiming('reservation_slot_interval_minutes', value)}
          />
          <TimingInput
            label="Min party"
            value={data.reservation_min_party_size}
            suffix="guests"
            min={1}
            max={99}
            onChange={(value) => setTiming('reservation_min_party_size', value)}
          />
          <TimingInput
            label="Max party"
            value={data.reservation_max_party_size}
            suffix="guests"
            min={1}
            max={99}
            onChange={(value) => setTiming('reservation_max_party_size', value)}
          />
          <TimingInput
            label="Turn time"
            value={data.reservation_default_duration_minutes}
            suffix="minutes"
            min={15}
            max={240}
            onChange={(value) => setTiming('reservation_default_duration_minutes', value)}
          />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
          <input
            type="checkbox"
            checked={data.reservation_windows_follow_operating_hours}
            onChange={(event) => updateData({ reservation_windows_follow_operating_hours: event.target.checked })}
            className="mt-1 h-4 w-4 rounded border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.05)] text-[rgb(var(--gold))] focus:ring-[rgba(212,168,84,0.5)] focus:ring-offset-0"
          />
          <span>
            <span className="block text-sm font-medium text-[rgb(var(--text-primary))]">Use operating hours as reservation windows</span>
            <span className="mt-1 block text-sm leading-6 text-[rgb(var(--text-secondary))]">
              Closed days stay closed, and open/close times from the hours step become the reservation service periods.
            </span>
          </span>
        </label>
      </section>

      <section className="p-6 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] space-y-5">
        <div>
          <p className="label-mono text-[rgb(var(--gold))] tracking-[0.12em]">ONLINE BOOKING</p>
          <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Website, app, and Google booking links.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TimingInput
            label="Book ahead"
            value={data.reservation_online_booking_horizon_days}
            suffix="days"
            min={0}
            max={365}
            onChange={(value) => setTiming('reservation_online_booking_horizon_days', value)}
          />
          <TimingInput
            label="Lead time"
            value={data.reservation_online_lead_time_minutes}
            suffix="minutes"
            min={0}
            max={10080}
            onChange={(value) => setTiming('reservation_online_lead_time_minutes', value)}
          />
          <TimingInput
            label="No-show grace"
            value={data.reservation_online_grace_period_minutes}
            suffix="minutes"
            min={0}
            max={360}
            onChange={(value) => setTiming('reservation_online_grace_period_minutes', value)}
          />
        </div>
      </section>

      {!useSameRules && (
        <section className="p-6 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] space-y-5">
          <div>
            <p className="label-mono text-[rgb(var(--gold))] tracking-[0.12em]">STAFF, PHONE & WALK-IN</p>
            <p className="mt-1 text-sm text-[rgb(var(--text-secondary))]">Reservations created by the host desk, by phone, or in person.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TimingInput
              label="Book ahead"
              value={data.reservation_staff_booking_horizon_days}
              suffix="days"
              min={0}
              max={365}
              onChange={(value) => setTiming('reservation_staff_booking_horizon_days', value)}
            />
            <TimingInput
              label="Lead time"
              value={data.reservation_staff_lead_time_minutes}
              suffix="minutes"
              min={0}
              max={10080}
              onChange={(value) => setTiming('reservation_staff_lead_time_minutes', value)}
            />
            <TimingInput
              label="No-show grace"
              value={data.reservation_staff_grace_period_minutes}
              suffix="minutes"
              min={0}
              max={360}
              onChange={(value) => setTiming('reservation_staff_grace_period_minutes', value)}
            />
          </div>
        </section>
      )}

      <div className="sticky bottom-4 z-20 rounded-xl border border-white/10 bg-[#101010]/90 p-3 shadow-2xl shadow-black/40 backdrop-blur">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-4 rounded-lg bg-white text-black font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
