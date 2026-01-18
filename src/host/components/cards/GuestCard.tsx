import { motion, AnimatePresence } from 'framer-motion'
import { Users, Clock, Phone, MessageSquare, Star, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Guest, TableRecommendation } from '../../types'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

interface GuestCardProps {
  guest: Guest
}

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || '550e8400-e29b-41d4-a716-446655440000'

export function GuestCard({ guest }: GuestCardProps) {
  const selectedGuestId = useRestaurantStore((s) => s.selectedGuestId)
  const setSelectedGuest = useRestaurantStore((s) => s.setSelectedGuest)
  const getRoutingRecommendations = useRestaurantStore((s) => s.getRoutingRecommendations)
  const seatGuest = useRestaurantStore((s) => s.seatGuest)
  const tables = useRestaurantStore((s) => s.tables)
  const isSelected = selectedGuestId === guest.id

  const [showRecommendations, setShowRecommendations] = useState(false)
  const [recommendations, setRecommendations] = useState<TableRecommendation[]>([])
  const [loading, setLoading] = useState(false)

  const waitTime = Math.round((Date.now() - guest.addedAt.getTime()) / 60000)

  const statusVariant = {
    waiting: 'default',
    notified: 'info',
    arriving: 'success',
    seated: 'success',
    no_show: 'danger',
  } as const

  const handleSeatClick = async () => {
    setLoading(true)
    try {
      const recs = await getRoutingRecommendations(RESTAURANT_ID, guest.partySize, guest.preferences)

      if (recs.length === 0) {
        // No match - show available tables as fallback
        const availableTables = tables.filter(t => t.status === 'available')
        setRecommendations(
          availableTables.slice(0, 3).map(t => ({
            table_id: t.id,
            table_number: t.tableNumber, // Use original backend table_number
            score: 0,
            reason: 'Available table',
          }))
        )
      } else {
        // Backend returns 1 optimal recommendation
        // Add 2 more alternatives from available tables that can fit the party
        const primaryRec = recs[0]
        const availableTables = tables
          .filter(t => t.status === 'available' && t.id !== primaryRec.table_id && t.capacity >= guest.partySize)
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
      // Fallback: show all available tables
      const availableTables = tables.filter(t => t.status === 'available')
      setRecommendations(
        availableTables.slice(0, 3).map(t => ({
          table_id: t.id,
          table_number: t.tableNumber, // Use original backend table_number
          score: 0,
          reason: 'Available table',
        }))
      )
      setShowRecommendations(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTable = (tableId: string) => {
    seatGuest(guest.id, tableId)
    setShowRecommendations(false)
    setRecommendations([])
  }

  const medals = ['🥇', '🥈', '🥉']

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
          {loading ? 'Loading...' : 'Seat'}
        </Button>
        <Button variant="ghost" size="sm">
          <Phone className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm">
          <MessageSquare className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Recommendations Modal - Portal to document body for proper z-index */}
      {createPortal(
        <AnimatePresence>
          {showRecommendations && recommendations.length > 0 && (
            <>
              {/* Backdrop */}
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

              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed top-[55%] left-4 z-[100] w-[360px]"
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
                    For {guest.name} (party of {guest.partySize})
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
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  )
}
