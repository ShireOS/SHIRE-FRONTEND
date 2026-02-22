import { ChevronRight, Clock, UtensilsCrossed, Sparkles, Check } from 'lucide-react'
import { alerts } from '../../data/mockData'

const iconMap = {
  clock: Clock,
  utensils: UtensilsCrossed,
  spray: Sparkles,
  check: Check
}

export function AlertsPanel() {
  return (
    <div className="h-full p-6 rounded-lg glass-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-dash-cream">
          System <span className="font-dash-display italic text-dash-gold">Alerts</span>
        </h3>
        <button className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors bg-dash-cream/5 px-3 py-1.5 rounded-lg border border-dash-border hover:border-dash-gold/30">
          VIEW LOG <ChevronRight size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = iconMap[alert.icon] || Clock

          const statusStyle =
            alert.severity === 'high' ? 'bg-dash-danger/10 border-dash-danger/30' :
            alert.severity === 'medium' ? 'bg-dash-warning/10 border-dash-warning/30' :
            'bg-dash-success/10 border-dash-success/30';

          const iconColor =
            alert.severity === 'high' ? 'text-dash-danger bg-dash-danger/20' :
            alert.severity === 'medium' ? 'text-dash-warning bg-dash-warning/20' :
            'text-dash-success bg-dash-success/20';

          return (
            <div
              key={alert.id}
              className={`
                group flex items-start gap-4 p-4 rounded-lg border
                ${statusStyle}
                transition-all duration-200 hover:border-dash-gold/30 cursor-pointer
              `}
            >
              <div className={`p-2 rounded-lg ${iconColor}`}>
                <Icon size={16} strokeWidth={2} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dash-cream mb-1 leading-snug">
                  {alert.message}
                </p>
                {alert.action && (
                  <button className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors">
                    {alert.action.toUpperCase()} <ChevronRight size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
