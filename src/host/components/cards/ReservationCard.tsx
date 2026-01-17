import { motion } from 'framer-motion'
import { Users, Clock, Phone, Calendar, MapPin } from 'lucide-react'
import type { Reservation } from '../../types'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

interface ReservationCardProps {
  reservation: Reservation
}

export function ReservationCard({ reservation }: ReservationCardProps) {
  const tables = useRestaurantStore((s) => s.tables)
  const assignedTable = tables.find((t) => t.id === reservation.tableId)

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
          <Button variant="success" size="sm" className="flex-1">
            Seat Now
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
    </motion.div>
  )
}
