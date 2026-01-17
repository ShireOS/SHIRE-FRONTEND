import { useRestaurantStore } from '../../stores/restaurantStore'
import { SectionTabs } from '../floor-plan/SectionTabs'
import { ServerModeToggle } from '../server/ServerModeToggle'
import { Table } from '../floor-plan/Table'
import { TablePopover } from '../floor-plan/TablePopover'

export function CenterPanel() {
  const tables = useRestaurantStore((s) => s.tables)
  const activeSection = useRestaurantStore((s) => s.activeSection)
  const serverMode = useRestaurantStore((s) => s.serverMode)
  const sections = useRestaurantStore((s) => s.sections)

  // Filter tables by active section
  const filteredTables = activeSection
    ? tables.filter((t) => t.sectionId === activeSection)
    : tables

  return (
    <div data-center-panel className="flex-1 flex flex-col h-full glass-panel-flat border-x border-white/[0.06]">
      {/* Header: Section Tabs + Mode Toggle */}
      <div className="border-b border-white/5">
        <SectionTabs />
        <ServerModeToggle />
      </div>

      {/* Floor Plan Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Section Overlays (when in sections mode) */}
        {serverMode === 'sections' && (
          <div className="absolute inset-0 pointer-events-none">
            {sections.map((section) => {
              if (activeSection && activeSection !== section.id) return null

              // Calculate bounds from table positions
              const sectionTables = tables.filter((t) => t.sectionId === section.id)
              if (sectionTables.length === 0) return null

              const minX = Math.min(...sectionTables.map((t) => t.position.x)) - 30
              const maxX = Math.max(...sectionTables.map((t) => t.position.x)) + 80
              const minY = Math.min(...sectionTables.map((t) => t.position.y)) - 30
              const maxY = Math.max(...sectionTables.map((t) => t.position.y)) + 80

              return (
                <div
                  key={section.id}
                  className="absolute rounded-xl border-2 border-dashed"
                  style={{
                    left: minX,
                    top: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                    borderColor: `${section.color}40`,
                    backgroundColor: `${section.color}08`,
                  }}
                >
                  <span
                    className="absolute -top-3 left-3 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: section.color,
                      color: '#000',
                    }}
                  >
                    {section.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Tables */}
        <div className="absolute inset-0 p-6">
          {filteredTables.map((table) => (
            <Table
              key={table.id}
              table={table}
              showSection={serverMode === 'sections'}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 glass-panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-tertiary mb-2 font-semibold">
            Legend
          </div>
          <div className="space-y-1.5">
            <LegendItem color="bg-accent-green" label="Available" />
            <LegendItem color="bg-accent-blue" label="Occupied" />
            <LegendItem color="bg-accent-yellow" label="Needs Server" />
            <LegendItem color="bg-accent-brown" label="Dirty" />
            <LegendItem color="bg-accent-purple" label="Reserved" />
            <LegendItem color="bg-white/20" label="Blocked" />
          </div>
        </div>
      </div>

      {/* Table Popover */}
      <TablePopover />
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs text-secondary">{label}</span>
    </div>
  )
}
