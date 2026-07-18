import { Plus, Trash2 } from 'lucide-react'
import type { SectionBehaviorData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface SectionsStepProps {
  onboarding: UseOnboardingReturn
}

const STARTER_SECTIONS = ['Hibachi', 'Main Dining', 'Bar', 'Patio', 'Outdoor']

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

const defaultBehavior = (name: string): SectionBehaviorData => ({
  name,
  service_mode: name.toLowerCase() === 'hibachi' ? 'hibachi' : name.toLowerCase() === 'bar' ? 'bar' : ['patio', 'outdoor'].includes(name.toLowerCase()) ? 'patio' : name.startsWith('New Section') ? 'custom' : 'standard',
  auto_gratuity_enabled: name.toLowerCase() === 'hibachi',
  auto_gratuity_type: 'percentage',
  auto_gratuity_value: '18',
  auto_gratuity_label: name.toLowerCase() === 'hibachi' ? 'Hibachi Service Charge' : `${name || 'Section'} Service Charge`,
  auto_gratuity_taxable: false,
  minimum_party_size: '',
  tip_prompt_mode: 'additional',
})

export function SectionsStep({ onboarding }: SectionsStepProps) {
  const { data, updateData, saveSections, nextStep, isLoading, error } = onboarding
  const sections = normalizeRows(data.sections)
  const behaviorFor = (name: string) => data.section_behaviors.find(item => item.name.toLowerCase() === name.toLowerCase()) || defaultBehavior(name)

  const updateSection = (index: number, value: string) => {
    const next = [...sections]
    const oldName = next[index]
    next[index] = index === 0 ? 'Table' : value
    const behaviors = data.section_behaviors.map(item => item.name.toLowerCase() === oldName.toLowerCase() ? { ...item, name: next[index] } : item)
    updateData({ sections: next, section_behaviors: behaviors })
  }

  const updateBehavior = (name: string, patch: Partial<SectionBehaviorData>) => {
    const current = behaviorFor(name)
    const others = data.section_behaviors.filter(item => item.name.toLowerCase() !== name.toLowerCase())
    updateData({ section_behaviors: [...others, { ...current, ...patch, name }] })
  }

  const removeSection = (index: number) => {
    if (index === 0) return
    const removed = sections[index]
    updateData({
      sections: sections.filter((_, currentIndex) => currentIndex !== index),
      section_behaviors: data.section_behaviors.filter(item => item.name.toLowerCase() !== removed.toLowerCase()),
    })
  }

  const addSection = (name = `New Section ${sections.length}`) => {
    updateData({
      sections: [...sections, name],
      section_behaviors: [...data.section_behaviors, defaultBehavior(name)],
    })
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
      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">{error}</div>}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm leading-6 text-[rgb(var(--text-secondary))]">
          Define each dining area and its service behavior here. Tables are assigned to these sections in the floor plan, and unassigned tables default to Table.
        </p>
      </div>

      <div className="space-y-4">
        <label className="label-mono block text-[rgb(var(--gold))]">Restaurant Sections</label>
        {sections.map((section, index) => {
          const behavior = behaviorFor(section)
          return (
            <div key={behavior.id || `${index}:${section}`} className="space-y-4 rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <div className="flex gap-2">
                <input
                  value={section}
                  disabled={index === 0}
                  onChange={event => updateSection(index, event.target.value)}
                  placeholder="Bar, Patio, Hibachi..."
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-tertiary))] disabled:bg-white/[0.025] disabled:text-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
                />
                <button type="button" title="Remove section" aria-label="Remove section" disabled={index === 0} onClick={() => removeSection(index)} className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 text-[rgb(var(--text-tertiary))] hover:text-red-300 disabled:opacity-35">
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm text-[rgb(var(--text-secondary))]">
                  <span>Section behavior</span>
                  <select value={behavior.service_mode} onChange={event => updateBehavior(section, { service_mode: event.target.value as SectionBehaviorData['service_mode'] })} className="w-full rounded-lg border border-white/10 bg-[#161616] px-3 py-2.5 text-[rgb(var(--text-primary))]">
                    <option value="standard">Standard dining</option>
                    <option value="hibachi">Hibachi</option>
                    <option value="bar">Bar</option>
                    <option value="patio">Patio</option>
                    <option value="counter">Counter service</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end rounded-lg border border-white/10 px-3 py-2.5 text-sm text-[rgb(var(--text-primary))]">
                  <input type="checkbox" checked={behavior.auto_gratuity_enabled} onChange={event => updateBehavior(section, { auto_gratuity_enabled: event.target.checked })} className="h-4 w-4 accent-[#d4a854]" />
                  Automatically apply service charge
                </label>
              </div>

              {behavior.auto_gratuity_enabled && (
                <div className="grid gap-3 border-t border-white/10 pt-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-[rgb(var(--text-secondary))]">
                    <span>Charge</span>
                    <div className="grid grid-cols-[1fr_7rem] gap-2">
                      <input inputMode="decimal" value={behavior.auto_gratuity_value} onChange={event => updateBehavior(section, { auto_gratuity_value: event.target.value.replace(/[^\d.]/g, '') })} className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[rgb(var(--text-primary))]" />
                      <select value={behavior.auto_gratuity_type} onChange={event => updateBehavior(section, { auto_gratuity_type: event.target.value as SectionBehaviorData['auto_gratuity_type'] })} className="rounded-lg border border-white/10 bg-[#161616] px-3 py-2.5 text-[rgb(var(--text-primary))]">
                        <option value="percentage">Percent</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </div>
                  </label>
                  <label className="space-y-2 text-sm text-[rgb(var(--text-secondary))]">
                    <span>Receipt label</span>
                    <input value={behavior.auto_gratuity_label} maxLength={120} onChange={event => updateBehavior(section, { auto_gratuity_label: event.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[rgb(var(--text-primary))]" />
                  </label>
                  <label className="space-y-2 text-sm text-[rgb(var(--text-secondary))]">
                    <span>Minimum party size</span>
                    <input inputMode="numeric" value={behavior.minimum_party_size} placeholder="Any party size" onChange={event => updateBehavior(section, { minimum_party_size: event.target.value.replace(/\D/g, '') })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-tertiary))]" />
                  </label>
                  <label className="space-y-2 text-sm text-[rgb(var(--text-secondary))]">
                    <span>Tip prompt</span>
                    <select value={behavior.tip_prompt_mode} onChange={event => updateBehavior(section, { tip_prompt_mode: event.target.value as SectionBehaviorData['tip_prompt_mode'] })} className="w-full rounded-lg border border-white/10 bg-[#161616] px-3 py-2.5 text-[rgb(var(--text-primary))]">
                      <option value="additional">Offer additional tip</option>
                      <option value="normal">Standard tip prompt</option>
                      <option value="disabled">No tip prompt</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3 text-sm text-[rgb(var(--text-primary))]">
                    <input type="checkbox" checked={behavior.auto_gratuity_taxable} onChange={event => updateBehavior(section, { auto_gratuity_taxable: event.target.checked })} className="h-4 w-4 accent-[#d4a854]" />
                    Charge is taxable
                  </label>
                </div>
              )}
            </div>
          )
        })}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={() => addSection()} title="Add section" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-[rgb(var(--text-secondary))] hover:border-[rgba(201,169,98,0.45)] hover:text-[rgb(var(--text-primary))]">
            <Plus size={16} /> Add section
          </button>
          {STARTER_SECTIONS.filter(name => !sections.some(section => section.toLowerCase() === name.toLowerCase())).map(name => (
            <button key={name} type="button" onClick={() => addSection(name)} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-[rgb(var(--text-tertiary))] hover:bg-white/[0.09] hover:text-[rgb(var(--text-primary))]">{name}</button>
          ))}
        </div>
      </div>

      <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-4 font-medium text-black hover:bg-gray-100 disabled:opacity-50">
        {isLoading ? <><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-t-2 border-[#d4a854]" />Saving...</> : 'Continue'}
      </button>
    </form>
  )
}
