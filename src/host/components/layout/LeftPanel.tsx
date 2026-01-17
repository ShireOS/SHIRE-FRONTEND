import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { GuestCard } from '../cards/GuestCard'
import { ReservationCard } from '../cards/ReservationCard'
import { cn } from '../../lib/cn'
import { cardStackVariants, cardItemVariants } from '../../lib/animations'

export function LeftPanel() {
  const activeTab = useRestaurantStore((s) => s.activeTab)
  const setActiveTab = useRestaurantStore((s) => s.setActiveTab)
  const guests = useRestaurantStore((s) => s.guests)
  const reservations = useRestaurantStore((s) => s.reservations)

  return (
    <div className="w-[380px] h-full glass-panel-flat border-r border-white/[0.06] flex flex-col">
      {/* Tabs */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1 p-1 rounded-lg bg-black/30">
          <TabButton
            active={activeTab === 'waitlist'}
            onClick={() => setActiveTab('waitlist')}
            count={guests.length}
          >
            Waitlist
          </TabButton>
          <TabButton
            active={activeTab === 'reservations'}
            onClick={() => setActiveTab('reservations')}
            count={reservations.length}
          >
            Reservations
          </TabButton>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-4 py-2 border-b border-white/[0.06]">
        {activeTab === 'waitlist' ? (
          <div className="flex items-center justify-between">
            <span className="label-mono">Est. wait</span>
            <span className="font-data text-xs text-primary">~12m</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="label-mono">Next arrival</span>
            <span className="font-data text-xs text-accent-yellow">15m</span>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        <AnimatePresence mode="wait">
          {activeTab === 'waitlist' ? (
            <motion.div
              key="waitlist"
              variants={cardStackVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {guests.map((guest) => (
                <motion.div key={guest.id} variants={cardItemVariants}>
                  <GuestCard guest={guest} />
                </motion.div>
              ))}
              {guests.length === 0 && (
                <EmptyState message="No guests waiting" />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="reservations"
              variants={cardStackVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {reservations.map((reservation) => (
                <motion.div key={reservation.id} variants={cardItemVariants}>
                  <ReservationCard reservation={reservation} />
                </motion.div>
              ))}
              {reservations.length === 0 && (
                <EmptyState message="No reservations today" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Button */}
      <div className="p-4 border-t border-white/[0.06]">
        <button className="w-full h-10 rounded-lg border border-dashed border-white/10 flex items-center justify-center gap-2 text-sm text-secondary hover:border-gold/40 hover:text-gold hover:bg-gold/5 transition-all">
          <Plus className="w-4 h-4" />
          {activeTab === 'waitlist' ? 'Add Walk-in' : 'Add Reservation'}
        </button>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all relative',
        active
          ? 'bg-white/[0.05] text-gold'
          : 'text-secondary hover:text-primary'
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          'ml-2 px-1.5 py-0.5 rounded font-data text-[10px]',
          active ? 'bg-gold/20 text-gold' : 'bg-white/10 text-tertiary'
        )}
      >
        {count}
      </span>
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-tertiary">
      <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
        <Plus className="w-5 h-5" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}
