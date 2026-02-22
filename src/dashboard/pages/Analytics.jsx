import { Card, CardContent } from '../components/shared/Card'
import { Badge } from '../components/shared/Badge'
import { Clock, Timer, ChefHat, TrendingUp, TrendingDown, DollarSign, Users, Receipt, Target, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { analyticsData } from '../data/mockData'

export function Analytics() {
  const { tableTurns, waitTimes, kitchenSpeed, peakHours, monthlyRevenue, weekComparison } = analyticsData

  // Calculate week-over-week changes
  const revenueChange = ((weekComparison.thisWeek.revenue - weekComparison.lastWeek.revenue) / weekComparison.lastWeek.revenue * 100).toFixed(1)
  const coversChange = ((weekComparison.thisWeek.covers - weekComparison.lastWeek.covers) / weekComparison.lastWeek.covers * 100).toFixed(1)

  // Get max covers for heatmap scaling
  const maxCovers = Math.max(...peakHours.flatMap(d => Object.values(d.hours)))

  // Color scale for heatmap (dark theme)
  const getHeatColor = (value) => {
    const intensity = value / maxCovers
    if (intensity > 0.8) return 'bg-dash-danger'
    if (intensity > 0.6) return 'bg-dash-warning'
    if (intensity > 0.4) return 'bg-dash-gold/60'
    if (intensity > 0.2) return 'bg-dash-gold/30'
    return 'bg-dash-cream/10'
  }

  const chartTheme = {
    axis: 'var(--dash-chart-axis)',
    tooltipBg: 'var(--dash-chart-tooltip-bg)',
    tooltipBorder: '1px solid var(--dash-chart-tooltip-border)',
    tooltipText: 'var(--dash-chart-tooltip-text)',
    tooltipLabel: 'var(--dash-chart-tooltip-label)',
    accent: 'var(--dash-chart-accent-line)',
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dash-cream">
          <span className="font-dash-display italic text-dash-gold">Analytics</span>
        </h1>
        <p className="text-dash-secondary mt-1">Deep dive into operations and revenue performance</p>
      </div>

      {/* Week Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dash-tertiary mb-1">This Week Revenue</p>
                <p className="text-2xl font-bold text-dash-cream">${weekComparison.thisWeek.revenue.toLocaleString()}</p>
                <div className={`flex items-center gap-1 mt-1 ${parseFloat(revenueChange) >= 0 ? 'text-dash-success' : 'text-dash-danger'}`}>
                  {parseFloat(revenueChange) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="text-sm font-medium">{revenueChange}% vs last week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-dash-success/20 border border-dash-success/30 rounded-xl flex items-center justify-center">
                <DollarSign size={24} className="text-dash-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dash-tertiary mb-1">This Week Covers</p>
                <p className="text-2xl font-bold text-dash-cream">{weekComparison.thisWeek.covers}</p>
                <div className={`flex items-center gap-1 mt-1 ${parseFloat(coversChange) >= 0 ? 'text-dash-success' : 'text-dash-danger'}`}>
                  {parseFloat(coversChange) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="text-sm font-medium">{coversChange}% vs last week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                <Users size={24} className="text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dash-tertiary mb-1">Avg Check</p>
                <p className="text-2xl font-bold text-dash-cream">${weekComparison.thisWeek.avgCheck.toFixed(2)}</p>
                <div className="flex items-center gap-1 mt-1 text-dash-success">
                  <TrendingUp size={14} />
                  <span className="text-sm font-medium">+$1.12 vs last week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
                <Receipt size={24} className="text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Table Turn Times */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-400" />
                <h3 className="font-semibold text-dash-cream">Table Turn Times</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-dash-cream">{tableTurns.average}min</span>
                <Badge variant={tableTurns.average > tableTurns.goal ? 'error' : 'success'}>
                  Goal: {tableTurns.goal}min
                </Badge>
              </div>
            </div>

            {tableTurns.average > tableTurns.goal && (
              <div className="flex items-center gap-2 p-3 bg-dash-warning/10 border border-dash-warning/30 rounded-lg mb-4">
                <AlertTriangle size={16} className="text-dash-warning" />
                <span className="text-sm text-dash-warning">Turn times {tableTurns.average - tableTurns.goal}min above goal</span>
              </div>
            )}

            <div className="h-48 bg-dash-base rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tableTurns.byDayOfWeek}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTheme.axis }} />
                  <YAxis hide domain={[0, 70]} />
                  <Tooltip
                    formatter={(value) => [`${value} min`, 'Turn Time']}
                    contentStyle={{ borderRadius: '8px', backgroundColor: chartTheme.tooltipBg, border: chartTheme.tooltipBorder, color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipLabel }}
                  />
                  <Bar dataKey="turnTime" radius={[4, 4, 0, 0]}>
                    {tableTurns.byDayOfWeek.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.turnTime > tableTurns.goal ? '#FBBF24' : '#4ADE80'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Wait Times */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Timer size={18} className="text-purple-400" />
                <h3 className="font-semibold text-dash-cream">Wait Times by Hour</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-dash-cream">{waitTimes.average}min</span>
                <span className="text-sm text-dash-tertiary">avg</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-dash-tertiary">Peak wait:</span>
                <span className="font-semibold text-dash-danger">{waitTimes.peakWait}min</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-dash-tertiary">Goal:</span>
                <span className="font-semibold text-dash-secondary">{waitTimes.goal}min</span>
              </div>
            </div>

            <div className="h-48 bg-dash-base rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waitTimes.byHour}>
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTheme.axis }} />
                  <YAxis hide domain={[0, 25]} />
                  <Tooltip
                    formatter={(value) => [`${value} min`, 'Wait Time']}
                    contentStyle={{ borderRadius: '8px', backgroundColor: chartTheme.tooltipBg, border: chartTheme.tooltipBorder, color: chartTheme.tooltipText }}
                    labelStyle={{ color: chartTheme.tooltipLabel }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wait"
                    stroke={chartTheme.accent}
                    strokeWidth={2}
                    dot={{ fill: chartTheme.accent, strokeWidth: 0, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Kitchen Speed */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ChefHat size={18} className="text-dash-warning" />
              <h3 className="font-semibold text-dash-cream">Kitchen Speed</h3>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-dash-cream">{kitchenSpeed.avgTicketTime}</span>
              <span className="text-dash-tertiary">min avg ticket</span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Badge variant={kitchenSpeed.avgTicketTime > kitchenSpeed.goal ? 'warning' : 'success'}>
                Goal: {kitchenSpeed.goal}min
              </Badge>
              <Badge variant="error">{kitchenSpeed.ticketsOver15} tickets over 15min</Badge>
            </div>

            <div className="space-y-3">
              <p className="label-mono">By Station</p>
              {kitchenSpeed.byStation.map((station) => (
                <div key={station.station} className="flex items-center justify-between">
                  <span className="text-sm text-dash-secondary">{station.station}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-dash-cream/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${station.avgTime > 14 ? 'bg-dash-danger' : station.avgTime > 10 ? 'bg-dash-warning' : 'bg-dash-success'}`}
                        style={{ width: `${(station.avgTime / 20) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-dash-cream w-12 text-right">{station.avgTime}min</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Peak Hours Heatmap */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target size={18} className="text-dash-danger" />
              <h3 className="font-semibold text-dash-cream">Peak Hours Heatmap</h3>
              <span className="text-sm text-dash-tertiary">(covers per hour)</span>
            </div>

            <div className="overflow-x-auto bg-dash-base rounded-lg p-3">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left label-mono pb-2"></th>
                    {['5pm', '6pm', '7pm', '8pm', '9pm', '10pm'].map(hour => (
                      <th key={hour} className="text-center label-mono pb-2 px-1">{hour}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {peakHours.map((dayData) => (
                    <tr key={dayData.day}>
                      <td className="text-xs font-medium text-dash-secondary py-1 pr-2">{dayData.day}</td>
                      {['5pm', '6pm', '7pm', '8pm', '9pm', '10pm'].map(hour => (
                        <td key={hour} className="p-1">
                          <div
                            className={`h-8 rounded flex items-center justify-center text-xs font-medium ${getHeatColor(dayData.hours[hour])} ${dayData.hours[hour] > maxCovers * 0.6 ? 'text-dash-base' : 'text-dash-cream'}`}
                          >
                            {dayData.hours[hour]}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4 mt-4 text-xs text-dash-tertiary">
              <span>Less busy</span>
              <div className="flex gap-1">
                <div className="w-6 h-3 bg-dash-cream/10 rounded" />
                <div className="w-6 h-3 bg-dash-gold/30 rounded" />
                <div className="w-6 h-3 bg-dash-gold/60 rounded" />
                <div className="w-6 h-3 bg-dash-warning rounded" />
                <div className="w-6 h-3 bg-dash-danger rounded" />
              </div>
              <span>More busy</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Trend */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-dash-success" />
              <h3 className="font-semibold text-dash-cream">Monthly Revenue Trend</h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-dash-tertiary">Last 7 months</p>
            </div>
          </div>

          <div className="h-64 bg-dash-base rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTheme.axis }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: chartTheme.axis }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: '8px', backgroundColor: chartTheme.tooltipBg, border: chartTheme.tooltipBorder, color: chartTheme.tooltipText }}
                  labelStyle={{ color: chartTheme.tooltipLabel }}
                />
                <Bar dataKey="revenue" fill={chartTheme.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
