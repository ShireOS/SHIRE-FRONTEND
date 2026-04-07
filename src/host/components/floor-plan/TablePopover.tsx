import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, User, Utensils, Ban, Undo2 } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { Button } from '../ui/Button'

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const safeHex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  const value = Number.parseInt(safeHex, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function TablePopover() {
  const selectedTableId = useRestaurantStore((s) => s.selectedTableId)
  const setSelectedTable = useRestaurantStore((s) => s.setSelectedTable)
  const tables = useRestaurantStore((s) => s.tables)
  const servers = useRestaurantStore((s) => s.servers)
  const sections = useRestaurantStore((s) => s.sections)
  const updateTableStatus = useRestaurantStore((s) => s.updateTableStatus)
  const unseatTable = useRestaurantStore((s) => s.unseatTable)
  const seatGuest = useRestaurantStore((s) => s.seatGuest)
  const guests = useRestaurantStore((s) => s.guests)

  const table = tables.find((t) => t.id === selectedTableId)
  const nextGuest = guests[0] // First guest in waitlist
  const server = table ? servers.find((s) => s.id === table.assignedServerId) : null
  const section = table ? sections.find((s) => s.id === table.sectionId) : null
  const accentColor = section?.color || server?.color || '#4F46E5'

  // Calculate popover position based on table position
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!table) return

    const updatePosition = () => {
      const tableElement = document.querySelector(`[data-floor-table-id="${table.id}"]`) as HTMLElement | null
      const stageElement = document.querySelector('[data-floor-stage]') as HTMLElement | null
      const scrollContainer = document.querySelector('[data-floor-scroll]') as HTMLElement | null

      if (!tableElement || !stageElement || !scrollContainer) return

      const tableRect = tableElement.getBoundingClientRect()
      const stageRect = stageElement.getBoundingClientRect()
      const popoverWidth = 332
      const popoverHeight = 344
      const gap = 12
      const relativeLeft = tableRect.left - stageRect.left
      const relativeRight = tableRect.right - stageRect.left
      const relativeTop = tableRect.top - stageRect.top

      let x = relativeRight + gap
      let y = relativeTop + tableRect.height / 2 - popoverHeight / 2

      if (x + popoverWidth > stageElement.clientWidth - 12) {
        x = relativeLeft - popoverWidth - gap
      }

      if (x < 12) {
        x = Math.max(12, Math.min(relativeLeft + gap, stageElement.clientWidth - popoverWidth - 12))
      }

      y = Math.max(12, Math.min(y, stageElement.clientHeight - popoverHeight - 12))

      setPosition({ x, y })
    }

    updatePosition()

    const scrollContainer = document.querySelector('[data-floor-scroll]')
    window.addEventListener('resize', updatePosition)
    scrollContainer?.addEventListener('scroll', updatePosition, { passive: true })

    return () => {
      window.removeEventListener('resize', updatePosition)
      scrollContainer?.removeEventListener('scroll', updatePosition)
    }
  }, [table])

  const shellStyle = useMemo(() => ({
    background: `linear-gradient(180deg, ${hexToRgba(accentColor, 0.22)} 0%, rgba(255,255,255,0.98) 38%, rgba(255,255,255,0.95) 100%)`,
    borderColor: hexToRgba(accentColor, 0.42),
    boxShadow: `0 28px 70px ${hexToRgba(accentColor, 0.22)}`,
  }), [accentColor])

  const headerStyle = useMemo(() => ({
    background: `linear-gradient(135deg, ${hexToRgba(accentColor, 0.22)} 0%, ${hexToRgba(accentColor, 0.08)} 100%)`,
    borderBottomColor: hexToRgba(accentColor, 0.18),
  }), [accentColor])

  const badgeStyle = useMemo(() => ({
    backgroundColor: hexToRgba(accentColor, 0.16),
    color: accentColor,
    borderColor: hexToRgba(accentColor, 0.28),
  }), [accentColor])

  if (!table) return null

  const statusLabels = {
    available: 'Available',
    occupied: 'Occupied',
    needs_server: 'Needs Server',
    dirty: 'Dirty',
    blocked: 'Blocked',
    reserved: 'Reserved',
  }

  const getSeatedTime = () => {
    if (!table.seatedAt) return null
    return Math.round((Date.now() - table.seatedAt.getTime()) / 60000)
  }

  const seatedTime = getSeatedTime()

  return (
    <AnimatePresence>
      {selectedTableId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="absolute z-30 w-[332px] rounded-2xl border overflow-hidden backdrop-blur-xl"
          style={{
            left: position.x,
            top: position.y,
            ...shellStyle,
          }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={headerStyle}>
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl border flex items-center justify-center"
                  style={{
                    backgroundColor: hexToRgba(accentColor, 0.14),
                    borderColor: hexToRgba(accentColor, 0.25),
                  }}
                >
                  <span className="text-xl font-semibold text-primary">{table.number}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">Table {table.number}</h3>
                  <p className="text-xs text-secondary uppercase tracking-[0.18em]">{section?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary transition-colors"
                style={{ backgroundColor: hexToRgba(accentColor, 0.1) }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info */}
            <div className="px-5 py-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Status</span>
                <span
                  className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]"
                  style={badgeStyle}
                >
                  {statusLabels[table.status]}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Capacity</span>
                <span className="font-data text-sm text-primary flex items-center gap-2">
                  <Users className="w-4 h-4 text-secondary" />
                  {table.capacity}
                </span>
              </div>

              {server && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Server</span>
                  <span className="text-sm text-primary flex items-center gap-2">
                    <User className="w-4 h-4 text-secondary" />
                    {server.name}
                  </span>
                </div>
              )}

              {seatedTime !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Seated</span>
                  <span className="font-data text-sm text-primary">{seatedTime}m</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 pt-3 space-y-3 border-t border-white/10">
              {table.status === 'available' && nextGuest && (
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 16px 28px ${hexToRgba(accentColor, 0.3)}`,
                  }}
                  onClick={() => seatGuest(nextGuest.id, table.id)}
                >
                  <Users className="w-3.5 h-3.5" />
                  Seat {nextGuest.name} ({nextGuest.partySize})
                </button>
              )}

              {table.status === 'available' && !nextGuest && (
                <div className="text-xs text-tertiary text-center py-2">
                  No guests waiting
                </div>
              )}

              {table.status === 'occupied' && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="md"
                    className="flex-1"
                    onClick={() => unseatTable(table.id)}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Unseat
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    onClick={() => updateTableStatus(table.id, 'dirty')}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    Cleared
                  </Button>
                </div>
              )}

              {table.status === 'dirty' && (
                <Button
                  variant="success"
                  size="md"
                  className="w-full"
                  onClick={() => updateTableStatus(table.id, 'available')}
                >
                  Mark Clean
                </Button>
              )}

              <div className="flex gap-2">
                {table.status !== 'blocked' ? (
                  <Button
                    variant="ghost"
                    size="md"
                    className="flex-1"
                    onClick={() => updateTableStatus(table.id, 'blocked')}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Block
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="md"
                    className="flex-1"
                    onClick={() => updateTableStatus(table.id, 'available')}
                  >
                    Unblock
                  </Button>
                )}
              </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
