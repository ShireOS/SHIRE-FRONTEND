import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Sun, Sofa, UtensilsCrossed, Home, Users, AlertTriangle, Clock } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { cn } from '../../lib/cn'
import type { Table, Server } from '../../types'

export function SmartCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const tables = useRestaurantStore((s) => s.tables)
  const servers = useRestaurantStore((s) => s.servers)
  const guests = useRestaurantStore((s) => s.guests)
  const activity = useRestaurantStore((s) => s.activity)
  const recommendations = useRestaurantStore((s) => s.recommendations)
  const seatGuest = useRestaurantStore((s) => s.seatGuest)
  const setSelectedTable = useRestaurantStore((s) => s.setSelectedTable)

  // Get first guest in waitlist for seating
  const nextGuest = guests[0]

  // Stats
  const highPriorityAlerts = activity.filter((a) => a.priority === 'high' && !a.read).length
  const waitlistCount = guests.length
  const avgWaitTime = Math.round(guests.reduce((sum, g) => sum + (Date.now() - g.addedAt.getTime()) / 60000, 0) / (guests.length || 1))

  // Helper to get available tables by criteria
  const getAvailableTablesBySection = (sectionId: string) => {
    return tables.filter((t) => t.sectionId === sectionId && t.status === 'available')
  }

  const getAvailableInsideTables = () => {
    return tables.filter((t) => t.sectionId !== 'outdoor' && t.status === 'available')
  }

  const getAvailableBooths = () => {
    return tables.filter((t) => t.shape === 'rectangle' && t.status === 'available')
  }

  const getAvailableRoundTables = () => {
    return tables.filter((t) => (t.shape === 'round' || t.shape === 'square') && t.status === 'available')
  }

  const getServer = (table: Table): Server | undefined => {
    return servers.find((s) => s.id === table.assignedServerId)
  }

  // Get best recommendation
  const bestRec = recommendations.find((r) => r.type === 'seat_suggestion')
  const bestTable = bestRec?.tableId ? tables.find((t) => t.id === bestRec.tableId) : null
  const bestGuest = bestRec?.guestId ? guests.find((guest) => guest.id === bestRec.guestId) : null

  // Get available tables by category
  const patioTables = getAvailableTablesBySection('outdoor')
  const mainTables = getAvailableInsideTables()
  const boothTables = getAvailableBooths()
  const regularTables = getAvailableRoundTables()

  const handleSeat = (tableId: string, guestId?: string) => {
    if (guestId) {
      seatGuest(guestId, tableId)
    } else if (nextGuest) {
      seatGuest(nextGuest.id, tableId)
    } else {
      setSelectedTable(tableId)
    }
  }

  return (
    <div className="h-[126px] xl:h-[110px] border-b border-white/[0.06] bg-gradient-to-r from-white/[0.01] to-transparent">
      <div
        ref={scrollRef}
        className="h-full flex items-stretch gap-3 overflow-x-auto scrollbar-hide px-4 py-3 xl:py-2.5"
      >
        {/* Best Match - AI Recommended */}
        {bestTable && (
          <SeatingCard
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="Best Match"
            table={bestTable}
            server={getServer(bestTable)}
            guestName={bestGuest ? `${bestGuest.name} (${bestGuest.partySize})` : undefined}
            onSeat={() => handleSeat(bestTable.id, bestRec?.guestId)}
            variant="primary"
          />
        )}

        {/* Outside / Patio */}
        {patioTables.length > 0 && (
          <SeatingCard
            icon={<Sun className="w-3.5 h-3.5" />}
            label="Outside"
            table={patioTables[0]}
            server={getServer(patioTables[0])}
            availableCount={patioTables.length}
            onSeat={() => handleSeat(patioTables[0].id)}
          />
        )}

        {/* Booth */}
        {boothTables.length > 0 && (
          <SeatingCard
            icon={<Sofa className="w-3.5 h-3.5" />}
            label="Booth"
            table={boothTables[0]}
            server={getServer(boothTables[0])}
            availableCount={boothTables.length}
            onSeat={() => handleSeat(boothTables[0].id)}
          />
        )}

        {/* Inside / Main Dining */}
        {mainTables.length > 0 && (
          <SeatingCard
            icon={<Home className="w-3.5 h-3.5" />}
            label="Inside"
            table={mainTables[0]}
            server={getServer(mainTables[0])}
            availableCount={mainTables.length}
            onSeat={() => handleSeat(mainTables[0].id)}
          />
        )}

        {/* Regular Tables */}
        {regularTables.length > 0 && (
          <SeatingCard
            icon={<UtensilsCrossed className="w-3.5 h-3.5" />}
            label="Table"
            table={regularTables[0]}
            server={getServer(regularTables[0])}
            availableCount={regularTables.length}
            onSeat={() => handleSeat(regularTables[0].id)}
          />
        )}

        {/* Divider */}
        <div className="w-px bg-white/[0.06] self-stretch my-1" />

        {/* Alerts Card */}
        <AlertsCard count={highPriorityAlerts} />

        {/* Waitlist Stats */}
        <StatsCard waitlistCount={waitlistCount} avgWaitTime={avgWaitTime} />
      </div>
    </div>
  )
}

// Unified Seating Card Component
function SeatingCard({
  icon,
  label,
  table,
  server,
  availableCount,
  onSeat,
  variant = 'default',
  guestName,
}: {
  icon: React.ReactNode
  label: string
  table: Table
  server?: Server
  availableCount?: number
  onSeat: () => void
  variant?: 'default' | 'primary'
  guestName?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'card-elevated min-w-[150px] flex-1 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer',
        'backdrop-blur-md border shadow-lg',
        variant === 'primary'
          ? 'border-accent-primary/40 bg-accent-primary/[0.08] hover:bg-accent-primary/[0.12] shadow-accent-primary/10'
          : 'border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.15]'
      )}
      onClick={onSeat}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className={variant === 'primary' ? 'text-accent-primary' : 'text-secondary'}>
              {icon}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">
              {label}
            </span>
          </div>
          {availableCount && availableCount > 1 && (
            <span className="font-data text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-tertiary">
              +{availableCount - 1}
            </span>
          )}
        </div>

        {/* Table info */}
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold leading-none text-primary">T{table.number}</span>
          <span className="flex items-center gap-0.5 font-data text-[10px] leading-none text-tertiary">
            <Users className="w-2.5 h-2.5" />
            {table.capacity}
          </span>
        </div>
        {guestName && (
          <div className="mt-1 truncate text-[10px] leading-tight font-medium text-primary/80">
            {guestName}
          </div>
        )}
      </div>

      {/* Server */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {server ? (
          <div className="min-w-0 flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
              style={{ backgroundColor: server.color }}
            >
              {server.initials[0]}
            </div>
            <span className="truncate text-[10px] leading-none text-secondary">{server.name}</span>
          </div>
        ) : (
          <span className="text-[10px] text-tertiary">—</span>
        )}
      </div>
    </motion.div>
  )
}

// Alerts Card
function AlertsCard({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'card-elevated flex-1 max-w-[120px] rounded-xl p-3 flex flex-col justify-between backdrop-blur-md border',
        count > 0
          ? 'border-accent-yellow/40 bg-accent-yellow/[0.08]'
          : 'border-white/[0.1] bg-white/[0.04]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <AlertTriangle className={cn('w-3.5 h-3.5', count > 0 ? 'text-accent-yellow' : 'text-tertiary')} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Alerts</span>
      </div>
      <div className="mt-1">
        <span className={cn('text-2xl font-bold', count > 0 ? 'text-accent-yellow' : 'text-tertiary')}>
          {count}
        </span>
        <span className="text-[10px] text-tertiary ml-1">active</span>
      </div>
    </motion.div>
  )
}

// Stats Card
function StatsCard({ waitlistCount, avgWaitTime }: { waitlistCount: number; avgWaitTime: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated flex-1 max-w-[130px] rounded-xl p-3 flex flex-col justify-between backdrop-blur-md border border-white/[0.1] bg-white/[0.04]"
    >
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-tertiary" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Waitlist</span>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold text-primary">{waitlistCount}</span>
        <span className="font-data text-[10px] text-tertiary">~{avgWaitTime}m</span>
      </div>
    </motion.div>
  )
}
