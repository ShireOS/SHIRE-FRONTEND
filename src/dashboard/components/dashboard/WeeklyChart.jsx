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
        <div className="bg-surface border border-border rounded-sm shadow-floating p-3">
          <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-sm font-mono tabular-nums" style={{ color: entry.color }}>
              <span className="font-sans text-secondary mr-2">{entry.name === 'thisWeek' ? 'Current' : 'Previous'}:</span>
              ${entry.value?.toLocaleString() || '-'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full p-6 rounded-lg bg-surface border border-border shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-primary">Revenue Trend</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-black rounded-sm" />
            <span className="text-xs font-medium text-secondary">This Week</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded-sm" />
            <span className="text-xs font-medium text-secondary">Last Week</span>
          </div>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis
              dataKey="day"
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 500 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6B7280', fontFamily: 'monospace' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E5E7EB' }} />
            <Line
              type="monotone"
              dataKey="lastWeek"
              stroke="#D1D5DB"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="thisWeek"
              stroke="#111827"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#111827', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#111827', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
