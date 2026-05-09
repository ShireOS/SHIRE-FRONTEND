import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useRestaurantStore } from '../host/stores/restaurantStore'
import { GuestCard } from '../host/components/cards/GuestCard'
import { ReservationCard } from '../host/components/cards/ReservationCard'
import { cn } from '../host/lib/cn'
import { cardStackVariants, cardItemVariants } from '../host/lib/animations'

export function LeftPanel({ onAddClick }: { onAddClick: (mode: 'walkin' | 'reservation', anchor: DOMRect) => void }) {
  const activeTab = useRestaurantStore((s) => s.activeTab)
  const setActiveTab = useRestaurantStore((s) => s.setActiveTab)
  const guests = useRestaurantStore((s) => s.guests)
  const reservations = useRestaurantStore((s) => s.reservations)

  return (
    <div className="w-[380px] h-full glass-panel-flat border-r border-white/[0.06] flex flex-col">
      {/* Tabs — bordered pill with inner divider */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex rounded-lg overflow-hidden border border-primary/[0.18]">
          <TabButton
            active={activeTab === 'waitlist'}
            onClick={() => setActiveTab('waitlist')}
            count={guests.length}
            divider
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
            <span className="font-data text-xs text-primary">—</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="label-mono">Next arrival</span>
            <span className="font-data text-xs text-primary">—</span>
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
        <button
          onClick={(e) => onAddClick(activeTab === 'waitlist' ? 'walkin' : 'reservation', (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
          className="w-full h-10 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold text-white bg-accent-green hover:brightness-110 active:brightness-95 transition-all shadow-[0_0_16px_rgba(74,222,128,0.25)]"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
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
  divider,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
  divider?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-2 px-3 text-sm font-medium transition-colors',
        divider && 'border-r border-primary/[0.18]',
        active
          ? 'bg-primary/[0.07] text-primary'
          : 'text-secondary hover:bg-primary/[0.05] hover:text-primary'
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          'ml-2 px-1.5 py-0.5 rounded font-data text-[10px]',
          active ? 'bg-primary/[0.1] text-primary' : 'bg-primary/[0.06] text-tertiary'
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
