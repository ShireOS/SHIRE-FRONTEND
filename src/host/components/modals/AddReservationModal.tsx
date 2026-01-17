import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Users, Clock, User, Phone } from 'lucide-react'
import { Button } from '../ui/Button'

interface AddReservationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReservationFormData) => void
}

interface ReservationFormData {
  guestName: string
  partySize: number
  phone: string
  date: string
  time: string
  notes: string
}

export function AddReservationModal({ isOpen, onClose, onSubmit }: AddReservationModalProps) {
  const [formData, setFormData] = useState<ReservationFormData>({
    guestName: '',
    partySize: 2,
    phone: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({
      guestName: '',
      partySize: 2,
      phone: '',
      date: new Date().toISOString().split('T')[0],
      time: '19:00',
      notes: '',
    })
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] z-50"
          >
            <div className="glass-panel p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-primary">New Reservation</h2>
                    <p className="text-xs text-tertiary">Add a new booking</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:text-primary hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Guest Name */}
                <div>
                  <label className="label-mono block mb-1.5">Guest Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                    <input
                      type="text"
                      value={formData.guestName}
                      onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                      placeholder="Enter guest name"
                      className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-primary placeholder:text-tertiary focus:outline-none focus:border-accent-primary/50 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Party Size & Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-mono block mb-1.5">Party Size</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                      <select
                        value={formData.partySize}
                        onChange={(e) => setFormData({ ...formData, partySize: Number(e.target.value) })}
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-primary focus:outline-none focus:border-accent-primary/50 transition-all appearance-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <option key={n} value={n} className="bg-[rgb(22,22,26)]">
                            {n} {n === 1 ? 'guest' : 'guests'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label-mono block mb-1.5">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-primary placeholder:text-tertiary focus:outline-none focus:border-accent-primary/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-mono block mb-1.5">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-primary focus:outline-none focus:border-accent-primary/50 transition-all"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label-mono block mb-1.5">Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                      <input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-primary focus:outline-none focus:border-accent-primary/50 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label-mono block mb-1.5">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Special requests, dietary restrictions..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-primary placeholder:text-tertiary focus:outline-none focus:border-accent-primary/50 transition-all resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    <Calendar className="w-4 h-4" />
                    Add Reservation
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
