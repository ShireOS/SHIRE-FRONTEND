import { ChevronRight, Sparkles } from 'lucide-react'
import { quickStats, alerts } from '../../data/mockData'

export function RightPanel({ onOpenChat }) {
  return (
    <aside className="dashboard-right-rail w-80 p-4 space-y-4 overflow-y-auto">
      {/* Concierge Preview - Premium Card */}
      <div className="overflow-hidden rounded-lg glass-card">
        <div className="p-5 bg-dash-gold/10 soft-divider-bottom">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center">
              <Sparkles size={20} className="text-dash-gold" />
            </div>
            <div>
              <p className="text-dash-cream font-semibold font-dash-display">
                <span className="italic">Concierge</span>
              </p>
              <p className="text-dash-tertiary text-xs italic">Watching your floor</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="label-mono mb-1">LATEST INSIGHT</p>
          <p className="text-sm text-dash-cream leading-relaxed">
            "Consider calling an <span className="font-dash-display italic text-dash-gold">extra server</span> for 7-9pm tonight."
          </p>
          <button
            onClick={onOpenChat}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-dash-gold bg-dash-gold/10 hover:bg-dash-gold/20 border border-dash-gold/30 rounded-lg transition-all"
          >
            Open Chat
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-lg glass-card p-4">
        <h3 className="text-sm font-semibold text-dash-cream mb-4">
          Quick <span className="font-dash-display italic text-dash-gold">Stats</span>
        </h3>
        <div className="space-y-2">
          <div className="rail-seam flex items-center justify-between py-2.5">
            <span className="text-sm text-dash-secondary">Tables Open</span>
            <span className="text-lg font-dash-display text-dash-cream tabular-nums">{quickStats.tablesOpen}</span>
          </div>
          <div className="rail-seam flex items-center justify-between py-2.5">
            <span className="text-sm text-dash-secondary">Staff On</span>
            <span className="text-lg font-dash-display text-dash-cream tabular-nums">{quickStats.staffOn}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-dash-secondary">Wait List</span>
            <span className="text-lg font-dash-display text-dash-cream tabular-nums">{quickStats.waitList}</span>
          </div>
        </div>
      </div>

      {/* Top Alerts */}
      <div className="rounded-lg glass-card p-4">
        <h3 className="text-sm font-semibold text-dash-cream mb-4">
          Top <span className="font-dash-display italic text-dash-gold">Alerts</span>
        </h3>
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, index) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg bg-dash-cream/5 hover:bg-dash-cream/10 transition-all cursor-pointer ${index < alerts.slice(0, 3).length - 1 ? 'rail-seam' : ''}`}
            >
              <span className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${alert.severity === 'high' ? 'bg-dash-danger' :
                  alert.severity === 'medium' ? 'bg-dash-warning' :
                    'bg-dash-success'
                }`} />
              <p className="text-xs text-dash-secondary leading-relaxed">{alert.message}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
