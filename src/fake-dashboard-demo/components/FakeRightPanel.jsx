import { ChevronRight, Sparkles } from 'lucide-react'
import { quickStats, alerts } from '../data/mimosasMockData'

export default function FakeRightPanel({ onOpenChat }) {
  const quickStatRows = [
    {
      id: 'tablesOpen',
      label: 'Tables Open',
      value: quickStats.tablesOpen,
      hover: 'hover:bg-dash-success/10 hover:border-dash-success/35',
      valueHover: 'group-hover:text-dash-success',
    },
    {
      id: 'staffOn',
      label: 'Staff On',
      value: quickStats.staffOn,
      hover: 'hover:bg-dash-gold/10 hover:border-dash-gold/35',
      valueHover: 'group-hover:text-dash-gold',
    },
    {
      id: 'waitList',
      label: 'Wait List',
      value: quickStats.waitList,
      hover: 'hover:bg-dash-warning/10 hover:border-dash-warning/35',
      valueHover: 'group-hover:text-dash-warning',
    },
  ]

  return (
    <aside className="dashboard-right-rail w-80 p-4 space-y-4 overflow-y-auto">
      <div className="overflow-hidden rounded-lg glass-card">
        <div className="p-5 bg-dash-gold/10 soft-divider-bottom">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center"><Sparkles size={20} className="text-dash-gold" /></div>
            <div>
              <p className="text-dash-cream font-semibold font-dash-display"><span className="italic">Concierge</span></p>
              <p className="text-dash-tertiary text-xs italic">Watching your floor</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="label-mono mb-1">LATEST INSIGHT</p>
          <p className="text-sm text-dash-cream leading-relaxed">"Fried Lobster & Waffles are selling 50% above average today. Consider pushing the <span className="font-dash-display italic text-dash-gold">Mimosa Flight</span> pairing."</p>
          <button onClick={onOpenChat} className="group mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-dash-gold bg-dash-gold/10 hover:bg-dash-gold/20 border border-dash-gold/30 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_22px_-18px_rgba(180,145,70,0.45)]">
            Open Chat <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
      <div className="rounded-lg glass-card p-4">
        <h3 className="text-sm font-semibold text-dash-cream mb-4">Quick <span className="font-dash-display italic text-dash-gold">Stats</span></h3>
        <div className="space-y-2">
          {quickStatRows.map((stat, index) => (
            <div
              key={stat.id}
              className={`group flex items-center justify-between py-2.5 px-2 rounded-md border border-transparent transition-all duration-200 hover:-translate-y-0.5 ${stat.hover} ${index < quickStatRows.length - 1 ? 'rail-seam' : ''}`}
            >
              <span className="text-sm text-dash-secondary transition-colors group-hover:text-dash-cream">{stat.label}</span>
              <span className={`text-lg font-dash-display text-dash-cream tabular-nums transition-colors ${stat.valueHover}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg glass-card p-4">
        <h3 className="text-sm font-semibold text-dash-cream mb-4">Top <span className="font-dash-display italic text-dash-gold">Alerts</span></h3>
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, index) => (
            <div
              key={alert.id}
              className={`group flex items-start gap-3 p-2.5 rounded-lg bg-dash-cream/5 border border-transparent transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${index < 2 ? 'rail-seam' : ''} ${
                alert.severity === 'high'
                  ? 'hover:bg-dash-danger/10 hover:border-dash-danger/40'
                  : alert.severity === 'medium'
                    ? 'hover:bg-dash-warning/10 hover:border-dash-warning/40'
                    : 'hover:bg-dash-success/10 hover:border-dash-success/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-125 ${alert.severity === 'high' ? 'bg-dash-danger' : alert.severity === 'medium' ? 'bg-dash-warning' : 'bg-dash-success'}`} />
              <p className="text-xs text-dash-secondary leading-relaxed transition-colors group-hover:text-dash-cream">{alert.message}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
