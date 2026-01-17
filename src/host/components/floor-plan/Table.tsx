import { motion } from 'framer-motion'
import type { Table as TableType } from '../../types'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { cn } from '../../lib/cn'

interface TableProps {
  table: TableType
  showSection?: boolean
}

const statusColors = {
  available: {
    bg: 'bg-accent-green/15',
    border: 'border-accent-green/50',
    text: 'text-accent-green',
    glow: 'shadow-[0_0_12px_rgba(74,222,128,0.15)]',
  },
  occupied: {
    bg: 'bg-accent-blue/12',
    border: 'border-accent-blue/40',
    text: 'text-accent-blue',
    glow: '',
  },
  needs_server: {
    bg: 'bg-accent-yellow/15',
    border: 'border-accent-yellow/50',
    text: 'text-accent-yellow',
    glow: 'shadow-[0_0_12px_rgba(250,204,21,0.2)] animate-pulse',
  },
  dirty: {
    bg: 'bg-accent-brown/12',
    border: 'border-accent-brown/40',
    text: 'text-accent-brown',
    glow: '',
  },
  blocked: {
    bg: 'bg-white/5',
    border: 'border-white/15',
    text: 'text-tertiary',
    glow: '',
  },
  reserved: {
    bg: 'bg-accent-purple/12',
    border: 'border-accent-purple/40',
    text: 'text-accent-purple',
    glow: '',
  },
}

const shapeSizes = {
  round: {
    2: 'w-12 h-12',
    4: 'w-14 h-14',
    6: 'w-16 h-16',
    8: 'w-20 h-20',
    10: 'w-24 h-24',
  },
  square: {
    2: 'w-12 h-12',
    4: 'w-14 h-14',
    6: 'w-16 h-16',
    8: 'w-20 h-20',
    10: 'w-24 h-24',
  },
  rectangle: {
    2: 'w-16 h-10',
    4: 'w-20 h-12',
    6: 'w-24 h-14',
    8: 'w-28 h-16',
    10: 'w-32 h-18',
  },
}

export function Table({ table, showSection = false }: TableProps) {
  const selectedTableId = useRestaurantStore((s) => s.selectedTableId)
  const setSelectedTable = useRestaurantStore((s) => s.setSelectedTable)
  const servers = useRestaurantStore((s) => s.servers)
  const guests = useRestaurantStore((s) => s.guests)
  const serverMode = useRestaurantStore((s) => s.serverMode)
  const seatGuest = useRestaurantStore((s) => s.seatGuest)
  const isSelected = selectedTableId === table.id
  const nextGuest = guests[0] // First in waitlist

  const colors = statusColors[table.status]
  const server = servers.find((s) => s.id === table.assignedServerId)

  const capacityKey = Math.min(Math.max(table.capacity, 2), 10) as 2 | 4 | 6 | 8 | 10
  const sizeClass = shapeSizes[table.shape][capacityKey] || shapeSizes[table.shape][4]

  // Timer progress for occupied tables
  const getTimerProgress = () => {
    if (table.status !== 'occupied' || !table.seatedAt) return 0
    const elapsed = (Date.now() - table.seatedAt.getTime()) / 60000
    const expected = 60
    return Math.min((elapsed / expected) * 100, 100)
  }

  const timerProgress = getTimerProgress()

  // In rotation mode, clicking available table seats next guest directly
  const handleClick = () => {
    if (serverMode === 'rotations' && table.status === 'available' && nextGuest) {
      seatGuest(nextGuest.id, table.id)
    } else {
      setSelectedTable(isSelected ? null : table.id)
    }
  }

  // Show quick-seat indicator in rotation mode
  const showQuickSeatIndicator = serverMode === 'rotations' && table.status === 'available' && nextGuest

  return (
    <motion.div
      className="absolute"
      style={{
        left: table.position.x,
        top: table.position.y,
        transform: `rotate(${table.rotation}deg)`,
      }}
    >
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        className={cn(
          'relative flex flex-col items-center justify-center transition-all duration-200',
          sizeClass,
          colors.bg,
          'border-2',
          colors.border,
          colors.glow,
          table.shape === 'round' ? 'rounded-full' : 'rounded-lg',
          isSelected && 'ring-2 ring-white/30 border-white/50 scale-105',
          table.status === 'blocked' && 'opacity-50',
          showQuickSeatIndicator && 'ring-2 ring-accent-green/40 animate-pulse',
          'hover:brightness-110'
        )}
        title={showQuickSeatIndicator ? `Click to seat ${nextGuest.name}` : undefined}
      >
        {/* Timer Ring */}
        {table.status === 'occupied' && timerProgress > 0 && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={cn(
                timerProgress > 80 ? 'text-accent-red/50' :
                timerProgress > 60 ? 'text-accent-orange/50' :
                'text-accent-blue/30'
              )}
              strokeDasharray={`${timerProgress * 2.89} 289`}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Table Number */}
        <span className={cn('text-sm font-semibold relative z-10', colors.text)}>
          {table.number}
        </span>

        {/* Capacity */}
        <span className="font-data text-[9px] text-tertiary relative z-10">
          {table.capacity}
        </span>

        {/* Server Badge */}
        {showSection && server && (
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-black"
            style={{ backgroundColor: server.color }}
          >
            {server.initials[0]}
          </div>
        )}

        {/* Status Badge */}
        {(table.status === 'reserved' || table.status === 'blocked') && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded text-[7px] font-data bg-black/80 text-white/60 uppercase">
            {table.status === 'reserved' ? 'res' : 'blk'}
          </div>
        )}

        {/* Quick Seat Badge (rotation mode) */}
        {showQuickSeatIndicator && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[7px] font-semibold bg-accent-green text-black uppercase whitespace-nowrap">
            Tap to seat
          </div>
        )}
      </motion.button>
    </motion.div>
  )
}
