import type { UseOnboardingReturn } from '../../hooks/useOnboarding'

interface SectionsStepProps {
  onboarding: UseOnboardingReturn
}

const STARTER_SECTIONS = ['Main Dining', 'Bar', 'Patio', 'Outdoor']

const normalizeRows = (sections: string[]) => {
  const seen = new Set<string>()
  const rows: string[] = []
  for (const section of ['Table', ...sections]) {
    const name = section.trim().replace(/\s+/g, ' ')
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(key === 'table' ? 'Table' : name)
  }
  return rows
}

export function SectionsStep({ onboarding }: SectionsStepProps) {
  const { data, updateData, saveSections, nextStep, isLoading, error } = onboarding
  const sections = normalizeRows(data.sections)

  const updateSection = (index: number, value: string) => {
    const next = [...sections]
    next[index] = index === 0 ? 'Table' : value
    updateData({ sections: next })
  }

  const removeSection = (index: number) => {
    if (index === 0) return
    updateData({ sections: sections.filter((_, currentIndex) => currentIndex !== index) })
  }

  const addSection = (name = `New Section ${sections.length}`) => {
    updateData({ sections: [...sections, name] })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveSections()
      nextStep()
    } catch {
      // Hook owns the visible error.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm leading-6 text-[rgb(var(--text-secondary))]">
          Create sections in your restaurant, like Bar, Patio, Outdoor, or Main Dining. These become categories for your floor plan: each table can be assigned to one, and unassigned tables default to Table.
        </p>
      </div>

      <div className="space-y-3">
        <label className="label-mono block text-[rgb(var(--gold))]">
          Restaurant Sections
        </label>
        {sections.map((section, index) => (
          <div key={`${index}:${index === 0 ? 'default' : ''}`} className="flex gap-2">
            <input
              value={section}
              disabled={index === 0}
              onChange={(event) => updateSection(index, event.target.value)}
              placeholder="Bar, Patio, Outdoor..."
              className="min-w-0 flex-1 px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] disabled:text-[rgb(var(--text-tertiary))] disabled:bg-[rgba(255,255,255,0.025)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            />
            <button
              type="button"
              disabled={index === 0}
              onClick={() => removeSection(index)}
              className="w-11 rounded-lg border border-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] transition-colors hover:text-red-300 disabled:opacity-35"
              aria-label="Remove section"
            >
              x
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => addSection('')}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-[rgb(var(--text-secondary))] transition-colors hover:border-[rgba(201,169,98,0.45)] hover:text-[rgb(var(--text-primary))]"
          >
            + Add section
          </button>
          {STARTER_SECTIONS.filter(name => !sections.some(section => section.toLowerCase() === name.toLowerCase())).map(name => (
            <button
              key={name}
              type="button"
              onClick={() => addSection(name)}
              className="rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-tertiary))] transition-colors hover:bg-[rgba(255,255,255,0.09)] hover:text-[rgb(var(--text-primary))]"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

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
