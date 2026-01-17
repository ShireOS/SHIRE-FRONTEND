import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, User, Utensils, Ban, Undo2 } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

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

  // Calculate popover position based on table position
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (table) {
      // Get the center panel element to calculate offset
      const centerPanel = document.querySelector('[data-center-panel]')
      const centerPanelRect = centerPanel?.getBoundingClientRect()
      const panelLeft = centerPanelRect?.left || 380

      // Position below the table, centered
      const popoverWidth = 280
      const popoverHeight = 280
      const viewportHeight = window.innerHeight

      // Calculate absolute position (table position is relative to center panel)
      let x = table.position.x + panelLeft - popoverWidth / 2 + 30
      let y = table.position.y + 80 + 170 // account for top bar + carousel

      // Clamp x to stay within viewport
      const rightEdge = window.innerWidth - 320 // account for right panel
      if (x + popoverWidth > rightEdge) {
        x = rightEdge - popoverWidth - 20
      }
      if (x < panelLeft + 10) {
        x = panelLeft + 10
      }

      // If would go off bottom, position above the table instead
      if (y + popoverHeight > viewportHeight - 20) {
        y = table.position.y + 170 - popoverHeight - 40
      }

      // Minimum y position
      if (y < 180) {
        y = 180
      }

      setPosition({ x, y })
    }
  }, [table])

  if (!table) return null

  const statusLabels = {
    available: 'Available',
    occupied: 'Occupied',
    needs_server: 'Needs Server',
    dirty: 'Dirty',
    blocked: 'Blocked',
    reserved: 'Reserved',
  }

  const statusColors = {
    available: 'success',
    occupied: 'info',
    needs_server: 'warning',
    dirty: 'default',
    blocked: 'default',
    reserved: 'purple',
  } as const

  const getSeatedTime = () => {
    if (!table.seatedAt) return null
    return Math.round((Date.now() - table.seatedAt.getTime()) / 60000)
  }

  const seatedTime = getSeatedTime()

  return (
    <AnimatePresence>
      {selectedTableId && (
        <>
          {/* Backdrop - subtle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={() => setSelectedTable(null)}
          />

          {/* Popover - positioned near table */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 w-[280px] bg-elevated border border-[rgba(var(--glass-border))] rounded-lg shadow-xl overflow-hidden dark:bg-[rgb(22,22,26)] light:shadow-[0_4px_24px_rgba(30,28,24,0.12)]"
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-base font-semibold text-primary">{table.number}</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-primary">Table {table.number}</h3>
                  <p className="text-[10px] text-tertiary uppercase tracking-wide">{section?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="w-6 h-6 rounded flex items-center justify-center text-tertiary hover:text-primary hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-tertiary">Status</span>
                <Badge variant={statusColors[table.status]} size="sm">
                  {statusLabels[table.status]}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-tertiary">Capacity</span>
                <span className="font-data text-xs text-primary flex items-center gap-1">
                  <Users className="w-3 h-3 text-tertiary" />
                  {table.capacity}
                </span>
              </div>

              {server && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tertiary">Server</span>
                  <span className="text-xs text-primary flex items-center gap-1">
                    <User className="w-3 h-3 text-tertiary" />
                    {server.name}
                  </span>
                </div>
              )}

              {seatedTime !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tertiary">Seated</span>
                  <span className="font-data text-xs text-primary">{seatedTime}m</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 pt-2 space-y-2 border-t border-white/[0.06]">
              {table.status === 'available' && nextGuest && (
                <Button
                  variant="success"
                  size="sm"
                  className="w-full"
                  onClick={() => seatGuest(nextGuest.id, table.id)}
                >
                  <Users className="w-3.5 h-3.5" />
                  Seat {nextGuest.name} ({nextGuest.partySize})
                </Button>
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
                    size="sm"
                    className="flex-1"
                    onClick={() => unseatTable(table.id)}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Unseat
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
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
                  size="sm"
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
                    size="sm"
                    className="flex-1"
                    onClick={() => updateTableStatus(table.id, 'blocked')}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Block
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => updateTableStatus(table.id, 'available')}
                  >
                    Unblock
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
