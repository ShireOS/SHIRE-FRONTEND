import { motion, AnimatePresence } from 'framer-motion'
import { Users, Clock, Phone, Calendar, MapPin, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Reservation, TableRecommendation } from '../../types'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

interface ReservationCardProps {
  reservation: Reservation
}

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || '550e8400-e29b-41d4-a716-446655440000'

export function ReservationCard({ reservation }: ReservationCardProps) {
  const tables = useRestaurantStore((s) => s.tables)
  const getRoutingRecommendations = useRestaurantStore((s) => s.getRoutingRecommendations)
  const seatGuest = useRestaurantStore((s) => s.seatGuest)
  const assignedTable = tables.find((t) => t.id === reservation.tableId)

  const [showRecommendations, setShowRecommendations] = useState(false)
  const [recommendations, setRecommendations] = useState<TableRecommendation[]>([])
  const [loading, setLoading] = useState(false)

  const timeUntil = Math.round((reservation.dateTime.getTime() - Date.now()) / 60000)
  const isArriving = timeUntil <= 15 && timeUntil > 0
  const isPast = timeUntil < 0

  const statusVariant = {
    confirmed: 'success',
    upcoming: 'default',
    arriving_soon: 'warning',
    arrived: 'info',
    seated: 'success',
    no_show: 'danger',
    cancelled: 'danger',
  } as const

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const handleSeatClick = async () => {
    setLoading(true)
    try {
      const recs = await getRoutingRecommendations(RESTAURANT_ID, reservation.partySize, reservation.specialRequests)

      if (recs.length === 0) {
        // No match - show available tables as fallback
        const availableTables = tables.filter(t => t.status === 'available' && t.capacity >= reservation.partySize)
        setRecommendations(
          availableTables.slice(0, 3).map(t => ({
            table_id: t.id,
            table_number: t.tableNumber,
            score: 0,
            reason: `${t.capacity}-top available`,
            table_capacity: t.capacity,
          }))
        )
      } else {
        const primaryRec = recs[0]
        const availableTables = tables
          .filter(t => t.status === 'available' && t.id !== primaryRec.table_id && t.capacity >= reservation.partySize)
          .slice(0, 2)
          .map(t => ({
            table_id: t.id,
            table_number: t.tableNumber,
            score: 50,
            reason: `${t.capacity}-top alternative`,
            table_capacity: t.capacity,
          }))

        setRecommendations([primaryRec, ...availableTables])
      }

      setShowRecommendations(true)
    } catch (error) {
      console.error('Failed to get recommendations:', error)
      const availableTables = tables.filter(t => t.status === 'available' && t.capacity >= reservation.partySize)
      setRecommendations(
        availableTables.slice(0, 3).map(t => ({
          table_id: t.id,
          table_number: t.tableNumber,
          score: 0,
          reason: `${t.capacity}-top available`,
          table_capacity: t.capacity,
        }))
      )
      setShowRecommendations(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTable = (tableId: string) => {
    // Create a temporary guest from reservation for seating
    seatGuest(reservation.id, tableId)
    setShowRecommendations(false)
    setRecommendations([])
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <motion.div
      layout
      className={cn(
        'card-elevated p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] transition-all',
        'hover:border-white/[0.12] hover:bg-white/[0.04]',
        isArriving && 'border-accent-yellow/30 bg-accent-yellow/[0.02]'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-base text-primary">{reservation.guestName}</h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 font-data text-xs text-secondary">
              <Users className="w-3 h-3" />
              {reservation.partySize}
            </span>
            <span className="flex items-center gap-1 font-data text-xs text-secondary">
              <Clock className="w-3 h-3" />
              {formatTime(reservation.dateTime)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusVariant[reservation.status]}>
            {reservation.status.replace('_', ' ')}
          </Badge>
          {!isPast && (
            <span className={cn(
              'font-data text-[10px] font-medium',
              isArriving ? 'text-accent-yellow' : 'text-tertiary'
            )}>
              {timeUntil > 0 ? `in ${timeUntil}m` : 'now'}
            </span>
          )}
        </div>
      </div>

      {/* Table Assignment */}
      {assignedTable && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          <MapPin className="w-3 h-3 text-tertiary" />
          <span className="text-secondary">
            Table {assignedTable.number}
          </span>
          <Badge variant="info" size="sm">
            Assigned
          </Badge>
        </div>
      )}

      {/* Special Requests */}
      {reservation.specialRequests.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {reservation.specialRequests.map((req, i) => (
            <Badge key={i} variant="purple" size="sm">
              {req}
            </Badge>
          ))}
        </div>
      )}

      {/* Notes */}
      {reservation.notes && (
        <p className="text-xs text-tertiary mb-3">{reservation.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {reservation.status === 'arriving_soon' || reservation.status === 'arrived' ? (
          <Button
            variant="success"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              handleSeatClick()
            }}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Seat Now'}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="flex-1">
            <Calendar className="w-3.5 h-3.5" />
            Edit
          </Button>
        )}
        <Button variant="ghost" size="sm">
          <Phone className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Backdrop - Portal for full-screen blur */}
      {createPortal(
        <AnimatePresence>
          {showRecommendations && recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => {
                e.stopPropagation()
                setShowRecommendations(false)
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal - Positioned relative to card */}
      <AnimatePresence>
        {showRecommendations && recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full left-0 mt-2 z-[101] w-full"
          >
                <div className="glass-panel p-6 rounded-xl border border-white/10">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-display text-primary">
                      Recommended Tables
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowRecommendations(false)
                      }}
                      className="text-tertiary hover:text-primary transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="text-sm text-secondary mb-4">
                    For {reservation.guestName} (party of {reservation.partySize})
                  </div>

                  {/* Recommendations List */}
                  <div className="space-y-2">
                    {recommendations.map((rec, index) => {
                      // ✅ Use capacity from recommendation (backend), not floor data
                      const capacity = rec.table_capacity || tables.find(t => t.id === rec.table_id)?.capacity
                      return (
                        <button
                          key={rec.table_id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectTable(rec.table_id)
                          }}
                          className="w-full glass-panel-flat p-4 rounded-lg border border-white/5 hover:border-accent-green/30 hover:bg-accent-green/5 transition-all text-left group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{medals[index]}</span>
                              <div>
                                <div className="font-semibold text-primary">
                                  Table {rec.table_number}
                                  {capacity && (
                                    <span className="text-xs text-tertiary ml-2">
                                      ({capacity}-top)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-tertiary mt-1">
                                  {rec.reason}
                                </div>
                              </div>
                            </div>
                            {rec.score > 0 && (
                              <div className="text-xs font-data text-accent-green">
                                {Math.round(rec.score)}%
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
