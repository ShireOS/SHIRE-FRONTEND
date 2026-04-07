import { useRestaurantStore } from '../../stores/restaurantStore'
import { SectionTabs } from '../floor-plan/SectionTabs'
import { ServerModeToggle } from '../server/ServerModeToggle'
import { Table } from '../floor-plan/Table'
import { TablePopover } from '../floor-plan/TablePopover'

export function CenterPanel() {
  const tables = useRestaurantStore((s) => s.tables)
  const activeSection = useRestaurantStore((s) => s.activeSection)
  const serverMode = useRestaurantStore((s) => s.serverMode)

  // Filter tables by active section
  const filteredTables = activeSection
    ? tables.filter((t) => t.sectionId === activeSection)
    : tables

  return (
    <div data-center-panel className="relative flex-1 flex flex-col h-full glass-panel-flat border-x border-white/[0.06]">
      {/* Header: Section Tabs + Mode Toggle */}
      <div className="border-b border-white/5">
        <SectionTabs />
        <ServerModeToggle />
      </div>

      {/* Floor Plan Canvas */}
      <div data-floor-scroll className="flex-1 relative overflow-auto">
        {/* Tables container */}
        <div data-floor-stage className="relative p-6" style={{ minWidth: '700px', minHeight: '420px' }}>
          {/* Tables */}
          {filteredTables.map((table) => (
            <Table
              key={table.id}
              table={table}
              showSection={serverMode === 'sections'}
            />
          ))}

          {/* Table Popover */}
          <TablePopover />
        </div>
      </div>

      {/* Legend - positioned outside scroll container */}
      <div className="absolute bottom-4 right-4 glass-panel p-3 z-10">
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
