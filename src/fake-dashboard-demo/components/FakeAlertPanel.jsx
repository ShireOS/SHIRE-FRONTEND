import { ChevronRight, Clock, UtensilsCrossed, Sparkles, Check } from 'lucide-react'
import { alerts } from '../data/mimosasMockData'

const iconMap = { clock: Clock, utensils: UtensilsCrossed, spray: Sparkles, check: Check }

export function FakeAlertPanel() {
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
          const statusStyle = alert.severity === 'high' ? 'bg-dash-danger/10 border-dash-danger/30' : alert.severity === 'medium' ? 'bg-dash-warning/10 border-dash-warning/30' : 'bg-dash-success/10 border-dash-success/30';
          const iconColor = alert.severity === 'high' ? 'text-dash-danger bg-dash-danger/20' : alert.severity === 'medium' ? 'text-dash-warning bg-dash-warning/20' : 'text-dash-success bg-dash-success/20';
          const hoverStyle = alert.severity === 'high'
            ? 'hover:bg-dash-danger/15 hover:border-dash-danger/50 hover:shadow-[0_14px_22px_-18px_rgba(220,53,69,0.55)]'
            : alert.severity === 'medium'
              ? 'hover:bg-dash-warning/15 hover:border-dash-warning/45 hover:shadow-[0_14px_22px_-18px_rgba(217,119,6,0.45)]'
              : 'hover:bg-dash-success/15 hover:border-dash-success/45 hover:shadow-[0_14px_22px_-18px_rgba(40,167,69,0.45)]'

          return (
            <div key={alert.id} className={`group flex items-start gap-4 p-4 rounded-lg border ${statusStyle} ${hoverStyle} transition-all duration-200 hover:-translate-y-0.5 cursor-pointer`}>
              <div className={`p-2 rounded-lg ${iconColor} transition-transform duration-200 group-hover:scale-105`}><Icon size={16} strokeWidth={2} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dash-cream mb-1 leading-snug transition-colors group-hover:text-dash-cream">{alert.message}</p>
                {alert.action && (
                  <button className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors">
                    <span>{alert.action.toUpperCase()}</span>
                    <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
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
