import { TrendingUp, TrendingDown, DollarSign, Users, Receipt, Clock } from 'lucide-react'

const icons = {
  revenue: DollarSign,
  covers: Users,
  avgCheck: Receipt,
  avgWait: Clock
}

const iconColors = {
  revenue: 'from-emerald-500 to-emerald-600',
  covers: 'from-blue-500 to-blue-600',
  avgCheck: 'from-violet-500 to-violet-600',
  avgWait: 'from-orange-500 to-orange-600'
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
    <div className="relative p-5 rounded-2xl bg-white border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${iconColors[type]} text-white shadow-lg`}>
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${isGood
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-rose-100 text-rose-700'
          }`}>
          {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span className="tabular-nums">{Math.abs(change)}%</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 tracking-tight tabular-nums">{formatValue(value)}</p>
      </div>

      {goal && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 mb-2">
            <span>Progress</span>
            <span className="text-gray-600">Target: {formatValue(goal)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${progress >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                  progress >= 75 ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                    progress >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                      'bg-gradient-to-r from-rose-400 to-rose-500'
                }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
