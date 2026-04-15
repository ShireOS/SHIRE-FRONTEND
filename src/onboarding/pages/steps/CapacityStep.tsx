import { useState, useEffect } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { FloorPlanEditor } from '../../components/FloorPlanEditor'
import type { FloorPlanTable } from '../../components/FloorPlanCanvas'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'

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
  const restaurantId = onboarding.restaurantId ?? ''

  const [floorPlanMode, setFloorPlanMode] = useState<null | 'upload' | 'manual'>(null)
  const [savedTables, setSavedTables] = useState<FloorPlanTable[]>([])

  // Load existing floor plan from DB on mount so tables survive page refresh
  useEffect(() => {
    if (!restaurantId) return
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ? `Bearer ${session.access_token}` : ''
      const res = await fetch(
        `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/floor-plan`,
        { headers: { Authorization: token } }
      ).catch(() => null)
      if (!res?.ok) return
      const fp = await res.json()
      if (fp.has_floor_plan && fp.tables?.length > 0) {
        // Map API nested position format → internal flat format
        const tables: FloorPlanTable[] = fp.tables.map((t: any) => ({
          id: t.id,
          center_x: t.position.center_x,
          center_y: t.position.center_y,
          width: t.position.width,
          height: t.position.height,
          capacity: t.capacity,
          shape: t.shape,
          confidence: t.confidence,
          notes: t.notes,
        }))
        setSavedTables(tables)
        updateData({ table_count: tables.length })
      }
    }
    void load()
  }, [restaurantId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveCapacity()
      nextStep()
    } catch {
      // Error handled by hook
    }
  }

  // Show floor plan editor full-screen
  if (floorPlanMode) {
    return (
      <FloorPlanEditor
        restaurantId={restaurantId}
        mode={floorPlanMode}
        initialTables={savedTables}
        onBack={() => setFloorPlanMode(null)}
        onSave={(tables) => {
          updateData({ table_count: tables.length })
          setSavedTables(tables)
          setFloorPlanMode(null)
        }}
      />

    )
  }

  const savedTableCount = savedTables.length > 0 ? savedTables.length : null

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

      {/* Floor Plan */}
      <div>
        <label className="label-mono block mb-3 text-[rgb(var(--gold))]">
          Floor Plan <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>

        {savedTableCount !== null && (
          <div className="mb-3 flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))]">
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Floor plan saved · {savedTableCount} table{savedTableCount !== 1 ? 's' : ''}
            <button
              type="button"
              onClick={() => setFloorPlanMode('manual')}
              className="ml-auto text-xs text-[rgb(var(--gold))] hover:opacity-80 transition-opacity"
            >
              Edit
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFloorPlanMode('upload')}
            className="p-4 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.06)] text-left transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-[rgb(var(--gold))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-[rgb(var(--text-primary))]">Upload Image</span>
            </div>
            <span className="text-xs text-[rgb(var(--text-tertiary))]">AI detects tables from your floor plan photo</span>
          </button>

          <button
            type="button"
            onClick={() => setFloorPlanMode('manual')}
            className="p-4 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.06)] text-left transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-[rgb(var(--gold))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="text-sm font-medium text-[rgb(var(--text-primary))]">Draw Manually</span>
            </div>
            <span className="text-xs text-[rgb(var(--text-tertiary))]">Place and arrange tables on a blank canvas</span>
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
