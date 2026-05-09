import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Users, Phone, User, Minus, Plus, Clock } from 'lucide-react'
import { useRestaurantStore } from '../host/stores/restaurantStore'
import type { Reservation } from '../host/types'

interface AddGuestModalProps {
  mode: 'walkin' | 'reservation'
  onClose: () => void
  anchor?: DOMRect
}

function getPositionStyle(anchor?: DOMRect): React.CSSProperties {
  if (!anchor) return {}
  const vh = window.innerHeight
  const vw = window.innerWidth
  const MODAL_W = 384
  const GAP = 8
  const isBottomOrigin = anchor.top > vh / 2
  if (isBottomOrigin) {
    // Bottom-left Add button: popup above, bottom-left at button's top-right
    return {
      bottom: vh - anchor.top + GAP,
      left: Math.min(anchor.right, vw - MODAL_W - GAP),
      top: 'auto',
      transform: 'none',
    }
  } else {
    // Top-right Add button: popup below, right-aligned to button
    return {
      top: anchor.bottom + GAP,
      right: Math.max(GAP, vw - anchor.right),
      left: 'auto',
      transform: 'none',
    }
  }
}

/** Generate 30-min slots starting at least 30 min from now */
function generateTimeSlots(): Date[] {
  const base = new Date()
  base.setMinutes(base.getMinutes() + 30) // push 30 min into future
  // Round up to next 30-min boundary
  const m = base.getMinutes()
  if (m > 0 && m !== 30) {
    if (m < 30) base.setMinutes(30, 0, 0)
    else { base.setHours(base.getHours() + 1, 0, 0, 0) }
  } else {
    base.setSeconds(0, 0)
  }
  const slots: Date[] = []
  for (let i = 0; i < 10; i++) {
    slots.push(new Date(base.getTime() + i * 30 * 60 * 1000))
  }
  return slots
}

function formatSlot(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function AddGuestModal({ mode, onClose, anchor }: AddGuestModalProps) {
  const addGuest = useRestaurantStore((s) => s.addGuest)
  const addActivity = useRestaurantStore((s) => s.addActivity)

  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null)

  const timeSlots = useMemo(() => generateTimeSlots(), [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'reservation' && !selectedSlot) return // require time selection

    const guestName = name.trim() || (mode === 'walkin' ? 'Walk-in' : 'Guest')

    if (mode === 'reservation' && selectedSlot) {
      // Add to reservations tab
      const newReservation: Reservation = {
        id: `r${Date.now()}`,
        guestName,
        partySize,
        phone: phone.trim(),
        email: '',
        dateTime: selectedSlot,
        status: 'upcoming',
        tableId: null,
        notes: notes.trim(),
        specialRequests: [],
        source: 'walk_in',
      }
      useRestaurantStore.setState((state) => ({
        reservations: [...state.reservations, newReservation],
      }))
    }

    // Add to waitlist tab (both modes)
    addGuest({
      name: guestName,
      partySize,
      phone: phone.trim(),
      estimatedWait: mode === 'walkin' ? partySize * 3 : 0,
      notes: notes.trim(),
      preferences: [],
      visitCount: 0,
      tags: mode === 'reservation' ? ['Reservation'] : [],
    })

    addActivity({
      type: 'wait_added',
      message: mode === 'reservation'
        ? `${guestName} (${partySize}) reservation at ${formatSlot(selectedSlot!)}`
        : `${guestName} (${partySize}) added to waitlist`,
      priority: 'low',
    })

    onClose()
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        style={getPositionStyle(anchor)}
        className={anchor
          ? 'fixed z-[101] w-full max-w-sm max-h-[85vh] overflow-y-auto'
          : 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-sm max-h-[90vh] overflow-y-auto'
        }
      >
        <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-display text-base text-primary">
              {mode === 'walkin' ? 'Add Walk-in' : 'Add Reservation'}
            </h2>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-primary transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-tertiary mb-1.5 uppercase tracking-wider font-medium">
                Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === 'walkin' ? 'Walk-in' : 'Guest name'}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-primary/[0.12] text-sm text-primary placeholder:text-tertiary focus:outline-none focus:border-primary/30 focus:bg-white/[0.06] transition-all"
                />
              </div>
            </div>

            {/* Party Size */}
            <div>
              <label className="block text-xs text-tertiary mb-1.5 uppercase tracking-wider font-medium">
                Party Size
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  className="w-9 h-9 rounded-lg border border-primary/[0.12] flex items-center justify-center text-secondary hover:bg-primary/[0.06] hover:text-primary transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/[0.04] border border-primary/[0.12]">
                  <Users className="w-3.5 h-3.5 text-tertiary" />
                  <span className="text-primary font-medium text-sm">{partySize}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPartySize(Math.min(20, partySize + 1))}
                  className="w-9 h-9 rounded-lg border border-primary/[0.12] flex items-center justify-center text-secondary hover:bg-primary/[0.06] hover:text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Time picker — reservation only */}
            {mode === 'reservation' && (
              <div>
                <label className="block text-xs text-tertiary mb-1.5 uppercase tracking-wider font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Reservation Time
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedSlot?.getTime() === slot.getTime()
                    return (
                      <button
                        key={slot.getTime()}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 rounded-lg text-sm font-medium transition-all border ${
                          isSelected
                            ? 'bg-accent-green/15 border-accent-green/50 text-accent-green'
                            : 'bg-white/[0.03] border-primary/[0.1] text-secondary hover:bg-primary/[0.05] hover:text-primary'
                        }`}
                      >
                        {formatSlot(slot)}
                      </button>
                    )
                  })}
                </div>
                {!selectedSlot && (
                  <p className="text-[11px] text-tertiary mt-1.5">Select a time to continue</p>
                )}
              </div>
            )}

            {/* Phone */}
            <div>
              <label className="block text-xs text-tertiary mb-1.5 uppercase tracking-wider font-medium">
                Phone <span className="text-muted normal-case tracking-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-primary/[0.12] text-sm text-primary placeholder:text-tertiary focus:outline-none focus:border-primary/30 focus:bg-white/[0.06] transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-tertiary mb-1.5 uppercase tracking-wider font-medium">
                Notes <span className="text-muted normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dietary needs, preferences..."
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-primary/[0.12] text-sm text-primary placeholder:text-tertiary focus:outline-none focus:border-primary/30 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={mode === 'reservation' && !selectedSlot}
              className="w-full py-2.5 rounded-lg bg-accent-green text-white font-semibold text-sm hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(74,222,128,0.2)]"
            >
              {mode === 'walkin' ? 'Add to Waitlist' : 'Confirm Reservation'}
            </button>
          </form>
        </div>
      </motion.div>
    </>,
    document.body
  )
}
