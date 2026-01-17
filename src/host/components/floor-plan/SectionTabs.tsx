import { useRestaurantStore } from '../../stores/restaurantStore'
import { cn } from '../../lib/cn'

export function SectionTabs() {
  const sections = useRestaurantStore((s) => s.sections)
  const activeSection = useRestaurantStore((s) => s.activeSection)
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection)
  const tables = useRestaurantStore((s) => s.tables)

  // Count available tables per section
  const getAvailableCount = (sectionId: string | null) => {
    const filtered = sectionId
      ? tables.filter((t) => t.sectionId === sectionId)
      : tables
    return filtered.filter((t) => t.status === 'available').length
  }

  const allSections = [
    { id: null, name: 'All', color: '#ffffff' },
    ...sections,
  ]

  return (
    <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
      {allSections.map((section) => {
        const isActive = activeSection === section.id
        const availableCount = getAvailableCount(section.id)

        return (
          <button
            key={section.id || 'all'}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              'relative px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              isActive
                ? 'bg-white/[0.08] text-primary border border-white/[0.12]'
                : 'text-secondary hover:text-primary hover:bg-white/[0.04] border border-transparent'
            )}
          >
            <span className="flex items-center gap-2">
              {section.id && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: section.color }}
                />
              )}
              {section.name}
              <span
                className={cn(
                  'font-data px-1.5 py-0.5 rounded text-[10px]',
                  isActive
                    ? 'bg-white/[0.1] text-primary'
                    : 'bg-white/[0.05] text-tertiary'
                )}
              >
                {availableCount}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
