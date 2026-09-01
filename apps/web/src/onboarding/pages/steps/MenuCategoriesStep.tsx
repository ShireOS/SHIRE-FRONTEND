import type { MenuCategoryData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface MenuCategoriesStepProps {
  onboarding: UseOnboardingReturn
}

const inputClass = 'w-full min-w-0 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const DEFAULT_STATIONS = ['Kitchen', 'Bar', 'Expo', 'Dessert', 'Coffee']
const FIRE_MODES = [
  ['', 'Use order default'],
  ['immediate', 'Immediate'],
  ['hold', 'Hold'],
  ['manual', 'Manual'],
  ['by_course', 'By course'],
] as const

const TAX_CLASS_LABELS: Record<string, string> = {
  prepared_food: 'Prepared food',
  merchandise: 'Merchandise',
  beer_on_premise: 'Beer — on premise',
  wine_on_premise: 'Wine — on premise',
  cider_on_premise: 'Cider — on premise',
  spirits_on_premise: 'Spirits — on premise',
  mixed_drink_on_premise: 'Mixed drinks — on premise',
  beer_off_premise: 'Beer — off premise',
  wine_off_premise: 'Wine — off premise',
  cider_off_premise: 'Cider — off premise',
  spirits_off_premise: 'Spirits — off premise',
  mixed_drink_off_premise: 'Mixed drinks — off premise',
}

function blankCategory(index: number): MenuCategoryData {
  return {
    name: `Custom Category ${index + 1}`,
    tax_rate_id: '',
    routing_station_id: '',
    routing_station_name: 'Kitchen',
    default_fire_mode: 'inherit',
    kds_display_group: '',
    is_active: true,
  }
}

export function MenuCategoriesStep({ onboarding }: MenuCategoriesStepProps) {
  const { data, updateData, saveMenuCategories, nextStep, isLoading, error } = onboarding
  const categories = data.menu_categories
  const enabledTaxClasses = data.enabled_tax_classes || []
  const requiresTaxClassification = enabledTaxClasses.length > 1
  const classificationsComplete = !requiresTaxClassification || categories.every(category => (
    enabledTaxClasses.includes(category.tax_class || '')
  ))

  const updateCategory = (index: number, patch: Partial<MenuCategoryData>) => {
    updateData({
      menu_categories: categories.map((category, currentIndex) =>
        currentIndex === index ? { ...category, ...patch } : category
      ),
    })
  }

  const removeCategory = (index: number) => {
    updateData({ menu_categories: categories.filter((_, currentIndex) => currentIndex !== index) })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await saveMenuCategories()
      nextStep()
    } catch {
      // Hook owns visible error.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Create the menu categories your restaurant actually uses, like appetizers, entrees, desserts, cocktails, happy hour, or custom groups. Prep station, fire timing, and KDS group are defaults for new items in that category. Taxes follow the verified restaurant location.
        </p>
      </div>

      <div className="space-y-3">
        {categories.map((category, index) => (
          <div key={category.id || `menu-category-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Category name</span>
                <input
                  value={category.name}
                  onChange={(event) => updateCategory(index, { name: event.target.value })}
                  className={inputClass}
                  placeholder="Appetizers"
                />
              </label>
              <button
                type="button"
                onClick={() => removeCategory(index)}
                className="self-end rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
            <div className={`mt-3 grid gap-3 ${requiresTaxClassification ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {requiresTaxClassification && (
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Sales tax class</span>
                  <select
                    value={category.tax_class || ''}
                    onChange={(event) => updateCategory(index, { tax_class: event.target.value })}
                    className={inputClass}
                    required
                  >
                    <option value="">Choose class</option>
                    {enabledTaxClasses.map(taxClass => (
                      <option key={taxClass} value={taxClass} className="bg-[#1a1a1a]">
                        {TAX_CLASS_LABELS[taxClass] || taxClass}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Default prep station</span>
                <input
                  value={category.routing_station_name}
                  onChange={(event) => updateCategory(index, { routing_station_name: event.target.value, routing_station_id: '' })}
                  className={inputClass}
                  list="menu-category-stations"
                  placeholder="Kitchen, Bar, Expo"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">Fire timing default</span>
                <select value={category.default_fire_mode || ''} onChange={(event) => updateCategory(index, { default_fire_mode: event.target.value as MenuCategoryData['default_fire_mode'] })} className={inputClass}>
                  {FIRE_MODES.map(([value, label]) => <option key={value} value={value} className="bg-[#1a1a1a]">{label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[rgb(var(--text-tertiary))]">KDS group</span>
                <input
                  value={category.kds_display_group || ''}
                  onChange={(event) => updateCategory(index, { kds_display_group: event.target.value })}
                  className={inputClass}
                  placeholder="Grill, Bar, Desserts"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <datalist id="menu-category-stations">
        {DEFAULT_STATIONS.map(station => <option key={station} value={station} />)}
      </datalist>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => updateData({ menu_categories: [...categories, blankCategory(categories.length)] })}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] px-4 py-3 text-sm font-semibold text-[rgb(var(--text-primary))] transition hover:bg-[rgba(255,255,255,0.05)]"
        >
          Add category
        </button>
        <button
          type="submit"
          disabled={isLoading || !classificationsComplete}
          className="rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </button>
      </div>
      {!classificationsComplete && (
        <p className="text-sm text-amber-200">Choose a sales tax class for every menu category. You are classifying what is sold—not entering a percentage.</p>
      )}
    </form>
  )
}
