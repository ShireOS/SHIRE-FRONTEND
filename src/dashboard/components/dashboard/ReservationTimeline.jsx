import { ChevronRight, AlertTriangle } from 'lucide-react'
import { reservations } from '../../data/mockData'

export function ReservationTimeline() {
  return (
    <div className="h-full p-6 rounded-lg glass-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-dash-cream font-dash-display">
          <span className="italic text-dash-gold">Timeline</span>
        </h3>
        <button className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors bg-dash-cream/5 px-3 py-1.5 rounded-lg border border-dash-border hover:border-dash-gold/30">
          FULL LIST <ChevronRight size={12} />
        </button>
      </div>

      <div className="space-y-4">
        {reservations.map((slot, idx) => {
          const isNearCapacity = slot.capacity >= 90
          const hasVIP = slot.parties.some(p => p.includes('VIP'))

          return (
            <div key={idx} className={`group py-3 ${idx < reservations.length - 1 ? 'rail-seam' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-dash-mono text-base font-semibold text-dash-cream">{slot.time}</span>
                  {hasVIP && (
                    <span className="flex items-center gap-1 label-mono bg-dash-gold/20 text-dash-gold px-1.5 py-0.5 rounded border border-dash-gold/30">
                      VIP
                    </span>
                  )}
                </div>
                <span className={`text-sm font-medium tabular-nums ${isNearCapacity ? 'text-dash-danger' : 'text-dash-secondary'}`}>
                  {slot.covers} covers
                </span>
              </div>

              {/* Capacity Bar */}
              <div className="h-1 w-full bg-dash-cream/10 rounded-sm overflow-hidden mb-2 soft-progress-track">
                <div
                  className={`h-full transition-all ${
                    slot.capacity >= 90 ? 'bg-dash-danger' :
                    slot.capacity >= 70 ? 'bg-dash-warning' :
                    'bg-dash-success'
                  }`}
                  style={{ width: `${slot.capacity}%` }}
                />
              </div>

              {/* Parties */}
              <p className="text-xs text-dash-secondary truncate group-hover:text-dash-cream transition-colors">
                {slot.parties.slice(0, 3).join(', ')}
                {slot.parties.length > 3 && ` +${slot.parties.length - 3}`}
              </p>

              {slot.warning && (
                <div className="flex items-center gap-1 mt-1 text-dash-danger">
                  <AlertTriangle size={10} />
                  <span className="label-mono text-dash-danger">CAPACITY WARNING</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
