import { ChevronRight } from 'lucide-react'
import { tables } from '../../data/mockData'

export function FloorStatus() {
  return (
    <div className="h-full p-6 rounded-lg glass-card relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-dash-cream">
          Floor <span className="font-dash-display italic text-dash-gold">Plan</span>
        </h3>
        <button className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors bg-dash-cream/5 px-3 py-1.5 rounded-lg border border-dash-border hover:border-dash-gold/30">
          VIEW DETAIL <ChevronRight size={14} />
        </button>
      </div>

      {/* Dark Terminal Embed */}
      <div className="bg-dash-base rounded-lg p-4 mb-6 soft-inset-surface">
        <div className="grid grid-cols-4 gap-3">
          {tables.map((table) => {
            const statusStyle =
              table.status === 'occupied' ? 'bg-dash-danger/20 border-dash-danger/40' :
              table.status === 'needsAttention' ? 'bg-dash-warning/20 border-dash-warning/40' :
              table.status === 'dirty' ? 'bg-dash-cream/5 border-dashed border-dash-tertiary/45' :
              'bg-dash-success/20 border-dash-success/40';

            const dotColor =
              table.status === 'occupied' ? 'bg-dash-danger' :
              table.status === 'needsAttention' ? 'bg-dash-warning' :
              table.status === 'dirty' ? 'bg-dash-neutral' :
              'bg-dash-success';

            return (
              <div
                key={table.id}
                className={`
                  aspect-square rounded-lg border flex flex-col items-center justify-center
                  cursor-pointer transition-all duration-200 hover:border-dash-gold/50
                  ${statusStyle}
                `}
                title={`Table ${table.id}`}
              >
                <span className="font-dash-display italic text-xl text-dash-cream">{table.id}</span>
                <span className={`w-2 h-2 rounded-full ${dotColor} mt-1.5`}></span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 label-mono pt-4 soft-divider-top">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-dash-danger" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-dash-warning" />
          <span>Needs Attn</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-dash-neutral" />
          <span>Dirty</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-dash-success" />
          <span>Open</span>
        </div>
      </div>
    </div>
  )
}
