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
    <div className="h-full p-6 rounded-2xl bg-white border border-gray-100 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-gray-900">System Alerts</h3>
        <button className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors uppercase tracking-wider bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300">
          View Log <ChevronRight size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon = iconMap[alert.icon] || Clock

          const statusStyle =
            alert.severity === 'high' ? 'bg-rose-50 border-rose-200' :
              alert.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
                'bg-emerald-50 border-emerald-200';

          const iconColor =
            alert.severity === 'high' ? 'text-rose-600 bg-rose-100' :
              alert.severity === 'medium' ? 'text-amber-600 bg-amber-100' :
                'text-emerald-600 bg-emerald-100';

          return (
            <div
              key={alert.id}
              className={`
                group flex items-start gap-4 p-4 rounded-xl border
                ${statusStyle}
                transition-all duration-200 hover:shadow-md cursor-pointer
              `}
            >
              <div className={`p-2 rounded-lg ${iconColor}`}>
                <Icon size={16} strokeWidth={2} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 mb-1 leading-snug">
                  {alert.message}
                </p>
                {alert.action && (
                  <button className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors uppercase tracking-wide">
                    {alert.action} <ChevronRight size={12} />
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
