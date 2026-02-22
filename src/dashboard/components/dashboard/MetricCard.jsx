import { TrendingUp, TrendingDown, DollarSign, Users, Receipt, Clock } from 'lucide-react'

const icons = {
  revenue: DollarSign,
  covers: Users,
  avgCheck: Receipt,
  avgWait: Clock
}

export function MetricCard({ type, title, value, change, goal, format = 'number' }) {
  const Icon = icons[type] || DollarSign
  const isPositive = change >= 0
  const isWaitTime = type === 'avgWait'
  const isGood = isWaitTime ? !isPositive : isPositive

  const formatValue = (val) => {
    if (format === 'currency') return `$${val.toLocaleString()}`
    if (format === 'time') return `${val} min`
    return val.toLocaleString()
  }

  const progress = goal ? Math.min((value / goal) * 100, 100) : 0

  return (
    <div className="metric-seam flex-1 px-6 py-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-dash-cream/5 text-dash-cream">
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${
          isGood
            ? 'bg-dash-success/20 text-dash-success'
            : 'bg-dash-danger/20 text-dash-danger'
        }`}>
          {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span className="tabular-nums font-dash-mono">{Math.abs(change)}%</span>
        </div>
      </div>

      <div>
        <p className="label-mono mb-1">{title.toUpperCase()}</p>
        <p className="text-3xl font-dash-display text-dash-cream tracking-tight tabular-nums">{formatValue(value)}</p>
      </div>

      {goal && (
        <div className="mt-4">
          <div className="flex items-center justify-between label-mono mb-2">
            <span>PROGRESS</span>
            <span className="text-dash-secondary font-dash-mono text-[10px]">Target: {formatValue(goal)}</span>
          </div>
          <div className="h-1 bg-dash-cream/10 rounded-sm overflow-hidden">
            <div
              className={`h-full rounded-sm transition-all duration-1000 ease-out ${
                progress >= 100 ? 'bg-dash-success' :
                progress >= 75 ? 'bg-dash-gold' :
                progress >= 50 ? 'bg-dash-warning' :
                'bg-dash-danger'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
