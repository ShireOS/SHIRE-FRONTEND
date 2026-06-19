import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface DemoFloorPlanProps {
  restaurantName: string
}

type TableStatus = 'occupied' | 'dirty' | 'clean' | 'reserved'

const STATUS_COLORS: Record<TableStatus, string> = {
  occupied: '#4ADE80',
  dirty: '#F87171',
  clean: 'rgba(255,255,255,0.3)',
  reserved: '#FBBF24',
}

const STATUS_LABELS: Record<TableStatus, string> = {
  occupied: 'Occupied',
  dirty: 'Needs Cleaning',
  clean: 'Available',
  reserved: 'Reserved',
}

const SERVERS = ['Alex M.', 'Sarah K.', 'James L.', 'Maria D.']
const STATUSES: TableStatus[] = ['occupied', 'dirty', 'clean', 'reserved']

interface TableData {
  id: number
  status: TableStatus
  server: string
}

export function DemoFloorPlan({ restaurantName }: DemoFloorPlanProps) {
  const [tables, setTables] = useState<TableData[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      status: STATUSES[i % 4],
      server: SERVERS[i % 4],
    }))
  )
  const [hoveredTable, setHoveredTable] = useState<number | null>(null)

  // Cycle table states every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setTables(prev =>
        prev.map(table => ({
          ...table,
          status: STATUSES[(STATUSES.indexOf(table.status) + 1) % STATUSES.length],
        }))
      )
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const occupiedCount = tables.filter(t => t.status === 'occupied').length
  const totalTables = tables.length

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
          <span className="label-mono text-[rgb(var(--text-secondary))]">{totalTables} TABLES TRACKED</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[rgb(var(--gold))]" />
          <span className="label-mono text-[rgb(var(--text-secondary))]">99.7% ACCURACY</span>
        </div>
      </div>

      {/* Floor grid */}
      <div className="grid grid-cols-4 gap-3">
        {tables.map((table, i) => (
          <motion.div
            key={table.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            onMouseEnter={() => setHoveredTable(table.id)}
            onMouseLeave={() => setHoveredTable(null)}
            className="relative aspect-square rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] flex flex-col items-center justify-center cursor-pointer hover:bg-[rgba(255,255,255,0.06)] transition-all"
          >
            {/* Status dot */}
            <motion.div
              className="w-3 h-3 rounded-full mb-2"
              animate={{ backgroundColor: STATUS_COLORS[table.status] }}
              transition={{ duration: 0.5 }}
            />
            <span className="text-[rgb(var(--text-primary))] text-sm font-medium">T{table.id}</span>
            <span className="text-[rgb(var(--text-tertiary))] text-[10px] mt-0.5">{STATUS_LABELS[table.status]}</span>

            {/* Tooltip */}
            {hoveredTable === table.id && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-2 bg-[rgba(20,20,20,0.95)] border border-[rgba(255,255,255,0.15)] rounded-lg text-xs whitespace-nowrap z-10 backdrop-blur-sm"
              >
                <p className="text-[rgb(var(--text-primary))] font-medium">Table #{table.id}</p>
                <p className="text-[rgb(var(--text-tertiary))]">Server: {table.server}</p>
                <p className="text-[rgb(var(--text-tertiary))]">{STATUS_LABELS[table.status]}</p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[rgb(var(--text-tertiary))] text-xs capitalize">{status}</span>
          </div>
        ))}
      </div>

      <p className="text-[rgb(var(--text-tertiary))] text-xs">
        AI vision cameras at {restaurantName} will track {occupiedCount}/{totalTables} occupied tables in real-time
      </p>
    </div>
  )
}
