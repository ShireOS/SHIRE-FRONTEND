import { useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { SmartTimeInput } from '../../../shared/components/SmartTimeInput'

interface HoursStepProps {
  onboarding: UseOnboardingReturn
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function HoursStep({ onboarding }: HoursStepProps) {
  const { data, updateData, saveOperatingHours, nextStep, isLoading, error } = onboarding
  const [sameHours, setSameHours] = useState(data.same_hours_every_day)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await saveOperatingHours()
      nextStep()
    } catch (err) {
      // Error handled by hook
    }
  }

  const updateDayHours = (dayIndex: number, field: 'open_time' | 'close_time' | 'is_closed', value: string | boolean) => {
    const newHours = [...data.operating_hours]
    newHours[dayIndex] = { ...newHours[dayIndex], [field]: value }

    if (sameHours && field !== 'is_closed') {
      newHours.forEach((day, i) => {
        if (!day.is_closed) {
          newHours[i] = { ...day, [field]: value }
        }
      })
    }

    updateData({ operating_hours: newHours })
  }

  const toggleSameHours = (same: boolean) => {
    setSameHours(same)
    updateData({ same_hours_every_day: same })

    if (same) {
      const firstOpen = data.operating_hours.find(d => !d.is_closed)
      if (firstOpen) {
        const newHours = data.operating_hours.map(day => ({
          ...day,
          open_time: day.is_closed ? day.open_time : firstOpen.open_time,
          close_time: day.is_closed ? day.close_time : firstOpen.close_time,
        }))
        updateData({ operating_hours: newHours })
      }
    }
  }

  const referenceHours = data.operating_hours.find(d => !d.is_closed) || data.operating_hours[1]

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Same hours toggle */}
      <div className="flex items-center justify-between p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-lg">
        <span className="text-[rgb(var(--text-secondary))] text-sm">Same hours every day?</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleSameHours(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sameHours
                ? 'bg-white text-black'
                : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))] hover:bg-[rgba(255,255,255,0.1)]'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => toggleSameHours(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !sameHours
                ? 'bg-white text-black'
                : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))] hover:bg-[rgba(255,255,255,0.1)]'
            }`}
          >
            No, different
          </button>
        </div>
      </div>

      {/* Hours grid */}
      {sameHours ? (
        <div className="p-6 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-lg space-y-4">
          <h3 className="text-[rgb(var(--text-primary))] font-medium text-sm">Opening Hours</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="label-mono block mb-1 text-[rgb(var(--gold))]">Opens</label>
              <SmartTimeInput
                ariaLabel="Restaurant opens"
                value={referenceHours.open_time}
                onChange={(value) => updateDayHours(1, 'open_time', value)}
                inputClassName="!rounded-lg"
              />
            </div>
            <span className="text-[rgb(var(--text-tertiary))] pt-6">to</span>
            <div className="flex-1">
              <label className="label-mono block mb-1 text-[rgb(var(--gold))]">Closes</label>
              <SmartTimeInput
                ariaLabel="Restaurant closes"
                value={referenceHours.close_time}
                onChange={(value) => updateDayHours(1, 'close_time', value)}
                inputClassName="!rounded-lg"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[rgba(255,255,255,0.06)]">
            <p className="label-mono text-[rgb(var(--text-tertiary))] mb-3">Closed days:</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => updateDayHours(i, 'is_closed', !data.operating_hours[i].is_closed)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    data.operating_hours[i].is_closed
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))] hover:bg-[rgba(255,255,255,0.1)]'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((day, i) => {
            const hours = data.operating_hours[i]
            return (
              <div
                key={day}
                className={`p-4 rounded-lg border transition-colors ${
                  hours.is_closed
                    ? 'bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.05)]'
                    : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hours.is_closed}
                        onChange={(e) => updateDayHours(i, 'is_closed', !e.target.checked)}
                        className="w-4 h-4 rounded border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.05)] text-[rgb(var(--gold))] focus:ring-[rgba(212,168,84,0.5)] focus:ring-offset-0"
                      />
                      <span className={`font-medium text-sm ${hours.is_closed ? 'text-[rgb(var(--text-tertiary))]' : 'text-[rgb(var(--text-primary))]'}`}>
                        {day}
                      </span>
                    </label>
                  </div>

                  {!hours.is_closed && (
                    <div className="flex items-center gap-2">
                      <SmartTimeInput
                        className="w-36"
                        ariaLabel={`${day} opens`}
                        value={hours.open_time}
                        onChange={(value) => updateDayHours(i, 'open_time', value)}
                        inputClassName="!rounded-lg !py-2"
                      />
                      <span className="text-[rgb(var(--text-tertiary))]">-</span>
                      <SmartTimeInput
                        className="w-36"
                        ariaLabel={`${day} closes`}
                        value={hours.close_time}
                        onChange={(value) => updateDayHours(i, 'close_time', value)}
                        inputClassName="!rounded-lg !py-2"
                      />
                    </div>
                  )}

                  {hours.is_closed && (
                    <span className="text-[rgb(var(--text-tertiary))] text-sm">Closed</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
