import { motion } from 'framer-motion'
import { Users, Clock, Phone, MessageSquare, Star } from 'lucide-react'
import type { Guest } from '../../types'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

interface GuestCardProps {
  guest: Guest
}

export function GuestCard({ guest }: GuestCardProps) {
  const selectedGuestId = useRestaurantStore((s) => s.selectedGuestId)
  const setSelectedGuest = useRestaurantStore((s) => s.setSelectedGuest)
  const isSelected = selectedGuestId === guest.id

  const waitTime = Math.round((Date.now() - guest.addedAt.getTime()) / 60000)

  const statusVariant = {
    waiting: 'default',
    notified: 'info',
    arriving: 'success',
    seated: 'success',
    no_show: 'danger',
  } as const

  return (
    <motion.div
      layout
      onClick={() => setSelectedGuest(isSelected ? null : guest.id)}
      className={cn(
        'card-elevated p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] cursor-pointer transition-all',
        'hover:border-white/[0.12] hover:bg-white/[0.04]',
        isSelected && 'ring-2 ring-accent-primary/40 border-accent-primary/30 bg-accent-primary/[0.04]'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base text-primary">{guest.name}</h3>
            {guest.tags.includes('VIP') && (
              <Star className="w-3.5 h-3.5 text-accent-yellow fill-accent-yellow" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 font-data text-xs text-secondary">
              <Users className="w-3 h-3" />
              {guest.partySize}
            </span>
            <span className="flex items-center gap-1 font-data text-xs text-secondary">
              <Clock className="w-3 h-3" />
              {waitTime}m
            </span>
          </div>
        </div>
        <Badge variant={statusVariant[guest.status]}>
          {guest.status === 'waiting' ? `~${guest.estimatedWait}m` : guest.status}
        </Badge>
      </div>

      {/* Tags */}
      {guest.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {guest.tags.filter(t => t !== 'VIP').map((tag) => (
            <Badge key={tag} variant="purple" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Notes */}
      {guest.notes && (
        <p className="text-xs text-tertiary mb-3 line-clamp-2">{guest.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="success" size="sm" className="flex-1">
          Seat
        </Button>
        <Button variant="ghost" size="sm">
          <Phone className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm">
          <MessageSquare className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  )
}
