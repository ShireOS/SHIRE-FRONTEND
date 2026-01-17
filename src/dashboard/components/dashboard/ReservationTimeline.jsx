import { ChevronRight, AlertTriangle, Crown } from 'lucide-react'
import { reservations } from '../../data/mockData'

export function ReservationTimeline() {
  return (
    <div className="h-full p-6 rounded-lg bg-surface border border-border shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-primary">Timeline</h3>
        <button className="text-xs font-mono font-medium text-secondary hover:text-primary flex items-center gap-1 transition-colors uppercase tracking-wider bg-app px-2 py-1 rounded border border-border">
          Full List <ChevronRight size={12} />
        </button>
      </div>

      <div className="space-y-4">
        {reservations.map((slot, idx) => {
          const isNearCapacity = slot.capacity >= 90
          const hasVIP = slot.parties.some(p => p.includes('VIP'))

          return (
            <div key={idx} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-primary">{slot.time}</span>
                  {hasVIP && (
                    <span className="flex items-center gap-1 text-[10px] bg-black text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide font-bold">
                      VIP
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium tabular-nums ${isNearCapacity ? 'text-red-600' : 'text-secondary'}`}>
                  {slot.covers} covers
                </span>
              </div>

              {/* Capacity Bar - Architectural */}
              <div className="h-1.5 w-full bg-app border border-border rounded-sm overflow-hidden mb-2 relative">
                <div
                  className={`h-full transition-all ${slot.capacity >= 90 ? 'bg-red-600' :
                      slot.capacity >= 70 ? 'bg-amber-500' :
                        'bg-emerald-600'
                    }`}
                  style={{ width: `${slot.capacity}%` }}
                />
              </div>

              {/* Parties */}
              <p className="text-xs text-secondary truncate group-hover:text-primary transition-colors">
                {slot.parties.slice(0, 3).join(', ')}
                {slot.parties.length > 3 && ` +${slot.parties.length - 3}`}
              </p>

              {slot.warning && (
                <div className="flex items-center gap-1 mt-1 text-red-600">
                  <AlertTriangle size={10} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Capacity Warning</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
