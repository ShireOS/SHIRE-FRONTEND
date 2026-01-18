import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { weeklyTrend } from '../../data/mockData'

export function WeeklyChart() {
  // Combine this week and last week data for the chart
  const chartData = weeklyTrend.thisWeek.map((item, idx) => ({
    day: item.day,
    thisWeek: item.revenue,
    lastWeek: weeklyTrend.lastWeek[idx]?.revenue
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card rounded-lg p-3">
          <p className="label-mono mb-1">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-sm font-dash-mono tabular-nums" style={{ color: entry.color }}>
              <span className="font-dash-body text-dash-secondary mr-2">{entry.name === 'thisWeek' ? 'Current' : 'Previous'}:</span>
              ${entry.value?.toLocaleString() || '-'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full p-6 rounded-lg glass-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-dash-cream">
          Revenue <span className="font-dash-display italic text-dash-gold">Trend</span>
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-dash-gold rounded-sm" />
            <span className="text-xs font-medium text-dash-secondary">This Week</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-dash-tertiary rounded-sm" />
            <span className="text-xs font-medium text-dash-secondary">Last Week</span>
          </div>
        </div>
      </div>

      {/* Dark Terminal Embed for Chart */}
      <div className="h-48 w-full bg-dash-base rounded-lg p-3 border border-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis
              dataKey="day"
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6B665A', fontFamily: 'JetBrains Mono' }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6B665A', fontFamily: 'JetBrains Mono' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <Line
              type="monotone"
              dataKey="lastWeek"
              stroke="#6B665A"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="thisWeek"
              stroke="#C9A962"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#C9A962', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#C9A962', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
