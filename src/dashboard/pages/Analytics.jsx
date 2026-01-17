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

  // Color scale for heatmap
  const getHeatColor = (value) => {
    const intensity = value / maxCovers
    if (intensity > 0.8) return 'bg-red-500'
    if (intensity > 0.6) return 'bg-orange-400'
    if (intensity > 0.4) return 'bg-amber-300'
    if (intensity > 0.2) return 'bg-yellow-200'
    return 'bg-gray-100'
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Deep dive into operations and revenue performance</p>
      </div>

      {/* Week Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">This Week Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${weekComparison.thisWeek.revenue.toLocaleString()}</p>
                <div className={`flex items-center gap-1 mt-1 ${parseFloat(revenueChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(revenueChange) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="text-sm font-medium">{revenueChange}% vs last week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign size={24} className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">This Week Covers</p>
                <p className="text-2xl font-bold text-gray-900">{weekComparison.thisWeek.covers}</p>
                <div className={`flex items-center gap-1 mt-1 ${parseFloat(coversChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(coversChange) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="text-sm font-medium">{coversChange}% vs last week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users size={24} className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Avg Check</p>
                <p className="text-2xl font-bold text-gray-900">${weekComparison.thisWeek.avgCheck.toFixed(2)}</p>
                <div className="flex items-center gap-1 mt-1 text-green-600">
                  <TrendingUp size={14} />
                  <span className="text-sm font-medium">+$1.12 vs last week</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Receipt size={24} className="text-purple-600" />
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
                <Clock size={18} className="text-blue-500" />
                <h3 className="font-semibold text-gray-900">Table Turn Times</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{tableTurns.average}min</span>
                <Badge variant={tableTurns.average > tableTurns.goal ? 'error' : 'success'}>
                  Goal: {tableTurns.goal}min
                </Badge>
              </div>
            </div>

            {tableTurns.average > tableTurns.goal && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm text-amber-700">Turn times {tableTurns.average - tableTurns.goal}min above goal</span>
              </div>
            )}

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tableTurns.byDayOfWeek}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <YAxis hide domain={[0, 70]} />
                  <Tooltip
                    formatter={(value) => [`${value} min`, 'Turn Time']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                  />
                  <Bar dataKey="turnTime" radius={[4, 4, 0, 0]}>
                    {tableTurns.byDayOfWeek.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.turnTime > tableTurns.goal ? '#F59E0B' : '#22C55E'}
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
                <Timer size={18} className="text-purple-500" />
                <h3 className="font-semibold text-gray-900">Wait Times by Hour</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{waitTimes.average}min</span>
                <span className="text-sm text-gray-500">avg</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Peak wait:</span>
                <span className="font-semibold text-red-600">{waitTimes.peakWait}min</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Goal:</span>
                <span className="font-semibold text-gray-700">{waitTimes.goal}min</span>
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waitTimes.byHour}>
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                  <YAxis hide domain={[0, 25]} />
                  <Tooltip
                    formatter={(value) => [`${value} min`, 'Wait Time']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wait"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ fill: '#8B5CF6', strokeWidth: 0, r: 4 }}
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
              <ChefHat size={18} className="text-orange-500" />
              <h3 className="font-semibold text-gray-900">Kitchen Speed</h3>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-gray-900">{kitchenSpeed.avgTicketTime}</span>
              <span className="text-gray-500">min avg ticket</span>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Badge variant={kitchenSpeed.avgTicketTime > kitchenSpeed.goal ? 'warning' : 'success'}>
                Goal: {kitchenSpeed.goal}min
              </Badge>
              <Badge variant="error">{kitchenSpeed.ticketsOver15} tickets over 15min</Badge>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">By Station</p>
              {kitchenSpeed.byStation.map((station) => (
                <div key={station.station} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{station.station}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${station.avgTime > 14 ? 'bg-red-400' : station.avgTime > 10 ? 'bg-amber-400' : 'bg-green-400'}`}
                        style={{ width: `${(station.avgTime / 20) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">{station.avgTime}min</span>
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
              <Target size={18} className="text-red-500" />
              <h3 className="font-semibold text-gray-900">Peak Hours Heatmap</h3>
              <span className="text-sm text-gray-500">(covers per hour)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2"></th>
                    {['5pm', '6pm', '7pm', '8pm', '9pm', '10pm'].map(hour => (
                      <th key={hour} className="text-center text-xs font-medium text-gray-500 pb-2 px-1">{hour}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {peakHours.map((dayData) => (
                    <tr key={dayData.day}>
                      <td className="text-xs font-medium text-gray-700 py-1 pr-2">{dayData.day}</td>
                      {['5pm', '6pm', '7pm', '8pm', '9pm', '10pm'].map(hour => (
                        <td key={hour} className="p-1">
                          <div
                            className={`h-8 rounded flex items-center justify-center text-xs font-medium ${getHeatColor(dayData.hours[hour])} ${dayData.hours[hour] > maxCovers * 0.6 ? 'text-white' : 'text-gray-700'}`}
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

            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
              <span>Less busy</span>
              <div className="flex gap-1">
                <div className="w-6 h-3 bg-gray-100 rounded" />
                <div className="w-6 h-3 bg-yellow-200 rounded" />
                <div className="w-6 h-3 bg-amber-300 rounded" />
                <div className="w-6 h-3 bg-orange-400 rounded" />
                <div className="w-6 h-3 bg-red-500 rounded" />
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
              <TrendingUp size={18} className="text-green-500" />
              <h3 className="font-semibold text-gray-900">Monthly Revenue Trend</h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Last 7 months</p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="revenue" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
