import type { MenuCategoryData, UseOnboardingReturn } from '../../hooks/useOnboarding'

interface MenuCategoriesStepProps {
  onboarding: UseOnboardingReturn
}

const inputClass = 'w-full min-w-0 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]'
const DEFAULT_STATIONS = ['Kitchen', 'Bar', 'Expo', 'Dessert', 'Coffee']

function blankCategory(index: number): MenuCategoryData {
  return {
    name: `Custom Category ${index + 1}`,
    tax_rate_id: '',
    routing_station_id: '',
    routing_station_name: 'Kitchen',
    is_active: true,
  }
}

export function MenuCategoriesStep({ onboarding }: MenuCategoriesStepProps) {
  const { data, updateData, saveMenuCategories, nextStep, isLoading, error } = onboarding
  const categories = data.menu_categories
  const taxRates = data.tax_rates

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
          Create menu categories like appetizers, entrees, desserts, cocktails, and custom groups. Each can inherit the default tax or use a tax override, and each can route to a logical prep station.
        </p>
      </div>

      <div className="space-y-3">
        {categories.map((category, index) => (
          <div key={category.id || `${category.name}:${index}`} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
              <input
                value={category.name}
                onChange={(event) => updateCategory(index, { name: event.target.value })}
                className={inputClass}
                placeholder="Appetizers"
              />
              <select value={category.tax_rate_id} onChange={(event) => updateCategory(index, { tax_rate_id: event.target.value })} className={inputClass}>
                <option value="" className="bg-[#1a1a1a]">Default tax</option>
                {taxRates.map(rate => (
                  <option key={rate.id || rate.name} value={rate.id || ''} className="bg-[#1a1a1a]">
                    {rate.name}{rate.rate ? ` · ${rate.rate}%` : ''}
                  </option>
                ))}
              </select>
              <input
                value={category.routing_station_name}
                onChange={(event) => updateCategory(index, { routing_station_name: event.target.value, routing_station_id: '' })}
                className={inputClass}
                list="menu-category-stations"
                placeholder="Kitchen, Bar, Expo"
              />
              <button
                type="button"
                onClick={() => removeCategory(index)}
                className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
              >
                Remove
              </button>
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
          disabled={isLoading}
          className="rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
