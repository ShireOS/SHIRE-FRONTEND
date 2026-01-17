import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent } from '../shared/Card'
import { Badge } from '../shared/Badge'
import { Button } from '../shared/Button'
import {
  ArrowLeft,
  Star,
  AlertTriangle,
  Edit,
  MessageSquare,
  Calendar,
  Check,
  Lightbulb,
  Loader2,
  WifiOff,
  RefreshCw
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useStaffProfileWithStatus } from '../../hooks/useStaffData'

export function StaffProfile() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { member, isLoading, isError, error, refetch } = useStaffProfileWithStatus(id)

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/staff')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Staff
        </button>
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading profile...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (isError || !member) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/staff')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Staff
        </button>
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <WifiOff size={40} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cannot Load Profile</h3>
              <p className="text-gray-600 mb-4">{error?.message || 'Staff member not found'}</p>

              {error && (
                <div className="bg-gray-50 rounded-lg p-4 text-left mb-4 max-w-md mx-auto">
                  <p className="text-xs font-mono text-gray-500 mb-1">Debug Info:</p>
                  <p className="text-xs font-mono text-gray-700">Status: {error?.status || 'N/A'}</p>
                  <p className="text-xs font-mono text-gray-700">Endpoint: {error?.endpoint || 'N/A'}</p>
                </div>
              )}

              <Button onClick={refetch} icon={<RefreshCw size={16} />}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'tips' ? 'Tips' : 'Efficiency'}: {entry.name === 'tips' ? `$${entry.value}` : `${entry.value}%`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/staff')}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        Back to Staff
      </button>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center text-2xl font-semibold text-gray-600">
              {member.name.split(' ').map(n => n[0]).join('')}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
                {member.badges.includes('topPerformer') && (
                  <Badge variant="success" dot>Top Performer</Badge>
                )}
                {member.badges.includes('struggling') && (
                  <Badge variant="warning" dot>Needs Support</Badge>
                )}
                {member.badges.includes('new') && (
                  <Badge variant="purple" dot>New Hire</Badge>
                )}
              </div>
              <p className="text-gray-600">{member.role} · {member.tenure}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" icon={<Edit size={16} />}>
                Edit
              </Button>
              <Button variant="outline" size="sm" icon={<MessageSquare size={16} />}>
                Message
              </Button>
              <Button variant="outline" size="sm" icon={<Calendar size={16} />}>
                Schedule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* This Month Stats */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">This Month</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Covers</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{member.thisMonth.covers}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Tips</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">${member.thisMonth.tips.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Avg/Cover</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">${member.thisMonth.avgTip.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Efficiency</p>
                <p className={`text-2xl font-bold tabular-nums ${
                  member.thisMonth.efficiency >= 90 ? 'text-green-600' :
                  member.thisMonth.efficiency >= 80 ? 'text-amber-600' :
                  member.thisMonth.efficiency ? 'text-red-600' : 'text-gray-400'
                }`}>
                  {member.thisMonth.efficiency ? `${member.thisMonth.efficiency}%` : '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">6 Month Trend</h3>
            {member.trendData.length > 0 ? (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={member.trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="tips"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-gray-400">
                Not enough data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Areas to Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Strengths</h3>
            <ul className="space-y-2">
              {member.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Areas to Watch</h3>
            <ul className="space-y-2">
              {member.areasToWatch.map((area, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{area}</span>
                </li>
              ))}
              {member.areasToWatch.length > 0 && (
                <li className="flex items-start gap-2 mt-3 p-3 bg-blue-50 rounded-lg">
                  <Lightbulb size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-blue-700">Suggestion: Consider wine pairing training</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent Shifts */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Shifts</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Hours</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Covers</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Tips</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {member.recentShifts.map((shift, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-3 text-sm text-gray-900">{shift.date}</td>
                    <td className="py-3 text-sm text-gray-600">{shift.hours}</td>
                    <td className="py-3 text-sm text-gray-900 text-right tabular-nums">{shift.covers}</td>
                    <td className="py-3 text-sm font-medium text-gray-900 text-right tabular-nums">${shift.tips}</td>
                    <td className="py-3 text-right">
                      {shift.efficiency ? (
                        <span className={`text-sm font-medium tabular-nums ${
                          shift.efficiency >= 90 ? 'text-green-600' :
                          shift.efficiency >= 80 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {shift.efficiency}%
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
