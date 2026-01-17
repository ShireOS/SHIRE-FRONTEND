import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Users, Calendar, Ban, ChevronDown, Undo2, Sun, Moon } from 'lucide-react'
import { LiveIndicator } from '../ui/LiveIndicator'
import { AddReservationModal } from '../modals/AddReservationModal'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { cn } from '../../lib/cn'

export function TopBar() {
  const [time, setTime] = useState(new Date())
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [reservationModalOpen, setReservationModalOpen] = useState(false)

  const addGuest = useRestaurantStore((s) => s.addGuest)
  const undo = useRestaurantStore((s) => s.undo)
  const undoHistory = useRestaurantStore((s) => s.undoHistory)
  const theme = useRestaurantStore((s) => s.theme)
  const toggleTheme = useRestaurantStore((s) => s.toggleTheme)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const handleAddGuest = () => {
    setDropdownOpen(false)
    addGuest({
      name: 'Walk-in',
      partySize: 2,
      phone: '',
      estimatedWait: 10,
      notes: '',
      preferences: [],
      visitCount: 0,
      tags: [],
    })
  }

  const handleAddReservation = () => {
    setDropdownOpen(false)
    setReservationModalOpen(true)
  }

  const handleReservationSubmit = (data: {
    guestName: string
    partySize: number
    phone: string
    date: string
    time: string
    notes: string
  }) => {
    addGuest({
      name: data.guestName,
      partySize: data.partySize,
      phone: data.phone,
      estimatedWait: 0,
      notes: data.notes,
      preferences: [],
      visitCount: 0,
      tags: ['Reservation'],
    })
  }

  return (
    <>
      <header className="h-14 glass-panel-flat border-b border-white/[0.06] px-6 flex items-center justify-between relative z-50">
        {/* Left: Logo */}
        <div className="flex items-center gap-8">
          <h1 className="font-display text-xl tracking-tight">
            <span className="text-primary font-semibold">SHIRE</span>
            <span className="text-tertiary font-normal ml-2 text-sm">Host</span>
          </h1>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
            <input
              type="text"
              placeholder="Search guests, tables..."
              className="w-64 h-8 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-primary placeholder:text-tertiary focus:outline-none focus:border-accent-primary/50 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </div>

        {/* Right: Status + Time + Undo + Add */}
        <div className="flex items-center gap-4">
          <LiveIndicator />

          <div className="font-data text-secondary text-xs tabular-nums tracking-wide">
            {formatTime(time)}
          </div>

          {/* Theme Toggle */}
          <motion.button
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-[rgba(var(--bg-hover),0.5)] transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <AnimatePresence mode="wait">
              {theme === 'dark' ? (
                <motion.div
                  key="sun"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="w-4 h-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Undo Button */}
          <button
            onClick={undo}
            disabled={undoHistory.length === 0}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
              undoHistory.length > 0
                ? 'text-secondary hover:text-primary hover:bg-white/[0.06]'
                : 'text-tertiary/50 cursor-not-allowed'
            )}
            title={undoHistory.length > 0 ? `Undo last action (${undoHistory.length} in history)` : 'Nothing to undo'}
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Add Dropdown */}
          <div className="relative">
            <motion.button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                'flex items-center gap-2 h-8 px-4 rounded-lg border text-sm font-medium transition-all',
                dropdownOpen
                  ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary'
                  : 'bg-white/[0.04] border-white/[0.08] text-secondary hover:bg-white/[0.08] hover:border-white/[0.12] hover:text-primary'
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', dropdownOpen && 'rotate-180')} />
            </motion.button>

            <AnimatePresence>
              {dropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  {/* Dropdown */}
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 glass-panel p-1.5 z-50"
                  >
                    <DropdownItem
                      icon={<Users className="w-4 h-4" />}
                      label="Add Walk-in"
                      sublabel="Quick add to waitlist"
                      onClick={handleAddGuest}
                    />
                    <DropdownItem
                      icon={<Calendar className="w-4 h-4" />}
                      label="Add Reservation"
                      sublabel="Book a table"
                      onClick={handleAddReservation}
                    />
                    <div className="h-px bg-white/[0.06] my-1" />
                    <DropdownItem
                      icon={<Ban className="w-4 h-4" />}
                      label="Block Table"
                      sublabel="Mark unavailable"
                      onClick={() => setDropdownOpen(false)}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Reservation Modal */}
      <AddReservationModal
        isOpen={reservationModalOpen}
        onClose={() => setReservationModalOpen(false)}
        onSubmit={handleReservationSubmit}
      />
    </>
  )
}

function DropdownItem({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-white/[0.06] group"
    >
      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-secondary group-hover:text-primary group-hover:bg-white/[0.08] transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-primary">{label}</p>
        {sublabel && <p className="text-[10px] text-tertiary">{sublabel}</p>}
      </div>
    </button>
  )
}
