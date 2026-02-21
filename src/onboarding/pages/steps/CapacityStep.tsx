import { useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { CameraTableLabeler } from '../../components/CameraTableLabeler'

interface CapacityStepProps {
  onboarding: UseOnboardingReturn
}

const CAPACITY_OPTIONS = [
  { value: 20, label: 'Small', description: 'Under 30 seats' },
  { value: 50, label: 'Medium', description: '30-60 seats' },
  { value: 80, label: 'Large', description: '60-100 seats' },
  { value: 150, label: 'Very Large', description: '100+ seats' },
]

export function CapacityStep({ onboarding }: CapacityStepProps) {
  const { data, updateData, saveCapacity, nextStep, isLoading, error } = onboarding
  const [showCameraLabeler, setShowCameraLabeler] = useState(false)
  const [newSection, setNewSection] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await saveCapacity()
      nextStep()
    } catch (err) {
      // Error handled by hook
    }
  }

  const addSection = () => {
    if (newSection.trim() && !data.sections.includes(newSection.trim())) {
      updateData({ sections: [...data.sections, newSection.trim()] })
      setNewSection('')
    }
  }

  const removeSection = (section: string) => {
    updateData({ sections: data.sections.filter(s => s !== section) })
  }

  if (showCameraLabeler) {
    return (
      <CameraTableLabeler
        onBack={() => setShowCameraLabeler(false)}
        onSave={(tables) => {
          updateData({ table_count: tables.length })
          setShowCameraLabeler(false)
        }}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Seating Capacity */}
      <div>
        <label className="label-mono block mb-3 text-[rgb(var(--gold))]">
          Approximate Seating Capacity
        </label>
        <div className="grid grid-cols-2 gap-3">
          {CAPACITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateData({ seating_capacity: opt.value })}
              className={`p-4 rounded-lg border text-left transition-all ${
                data.seating_capacity === opt.value
                  ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)] shadow-[0_0_12px_rgba(201,169,98,0.1)]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              <span className="block text-[rgb(var(--text-primary))] font-medium text-sm">{opt.label}</span>
              <span className="block text-sm text-[rgb(var(--text-tertiary))]">{opt.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <input
            type="number"
            value={data.seating_capacity || ''}
            onChange={(e) => updateData({ seating_capacity: parseInt(e.target.value) || null })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="Or enter exact number..."
          />
        </div>
      </div>

      {/* Table Count */}
      <div>
        <label className="label-mono block mb-2 text-[rgb(var(--gold))]">
          Number of Tables <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>
        <div className="flex gap-3">
          <input
            type="number"
            value={data.table_count || ''}
            onChange={(e) => updateData({ table_count: parseInt(e.target.value) || null })}
            className="flex-1 px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="e.g., 25"
          />
          <button
            type="button"
            onClick={() => setShowCameraLabeler(true)}
            className="px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-secondary))] hover:bg-[rgba(255,255,255,0.1)] hover:text-[rgb(var(--text-primary))] transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Setup from Camera
          </button>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">
          Use camera view to visually label tables in your floor plan
        </p>
      </div>

      {/* Sections */}
      <div>
        <label className="label-mono block mb-3 text-[rgb(var(--gold))]">
          Sections <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {data.sections.map(section => (
            <span
              key={section}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-full text-sm text-[rgb(var(--text-secondary))]"
            >
              {section}
              <button
                type="button"
                onClick={() => removeSection(section)}
                className="ml-1 text-[rgb(var(--text-tertiary))] hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSection}
            onChange={(e) => setNewSection(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSection())}
            className="flex-1 px-4 py-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="Add section (e.g., Rooftop)"
          />
          <button
            type="button"
            onClick={addSection}
            className="px-4 py-2 bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-[rgb(var(--text-primary))] rounded-lg transition-colors"
          >
            Add
          </button>
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
