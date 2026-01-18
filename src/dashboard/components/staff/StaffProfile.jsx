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
          className="flex items-center gap-2 text-sm text-dash-secondary hover:text-dash-cream mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Staff
        </button>
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 size={32} className="animate-spin text-dash-gold mx-auto mb-4" />
            <p className="text-dash-cream font-medium">Loading profile...</p>
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
          className="flex items-center gap-2 text-sm text-dash-secondary hover:text-dash-cream mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Staff
        </button>
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <WifiOff size={40} className="text-dash-danger mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-dash-cream mb-2">Cannot Load Profile</h3>
              <p className="text-dash-secondary mb-4">{error?.message || 'Staff member not found'}</p>

              {error && (
                <div className="bg-dash-base rounded-lg p-4 text-left mb-4 max-w-md mx-auto border border-dash-border">
                  <p className="label-mono mb-1">DEBUG INFO</p>
                  <p className="text-xs font-dash-mono text-dash-secondary">Status: {error?.status || 'N/A'}</p>
                  <p className="text-xs font-dash-mono text-dash-secondary">Endpoint: {error?.endpoint || 'N/A'}</p>
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
        <div className="glass-card p-3">
          <p className="text-sm font-medium text-dash-cream mb-1">{label}</p>
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
        className="flex items-center gap-2 text-sm text-dash-secondary hover:text-dash-cream mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        Back to Staff
      </button>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 bg-dash-gold/20 border border-dash-gold/30 rounded-2xl flex items-center justify-center text-2xl font-semibold text-dash-gold">
              {member.name.split(' ').map(n => n[0]).join('')}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-dash-cream">{member.name}</h1>
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
              <p className="text-dash-secondary">{member.role} · {member.tenure}</p>
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
            <h3 className="label-mono mb-4">THIS MONTH</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-dash-tertiary mb-1">Covers</p>
                <p className="text-2xl font-bold text-dash-cream tabular-nums">{member.thisMonth.covers}</p>
              </div>
              <div>
                <p className="text-sm text-dash-tertiary mb-1">Tips</p>
                <p className="text-2xl font-bold text-dash-cream tabular-nums">${member.thisMonth.tips.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-dash-tertiary mb-1">Avg/Cover</p>
                <p className="text-2xl font-bold text-dash-cream tabular-nums">${member.thisMonth.avgTip.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-dash-tertiary mb-1">Efficiency</p>
                <p className={`text-2xl font-bold tabular-nums ${
                  member.thisMonth.efficiency >= 90 ? 'text-dash-success' :
                  member.thisMonth.efficiency >= 80 ? 'text-dash-warning' :
                  member.thisMonth.efficiency ? 'text-dash-danger' : 'text-dash-tertiary'
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
            <h3 className="label-mono mb-4">6 MONTH TREND</h3>
            {member.trendData.length > 0 ? (
              <div className="h-32 bg-dash-base rounded-lg p-2 border border-dash-border">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={member.trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#6B665A' }}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="tips"
                      stroke="#C9A962"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-dash-tertiary bg-dash-base rounded-lg border border-dash-border">
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
            <h3 className="label-mono mb-4">STRENGTHS</h3>
            <ul className="space-y-2">
              {member.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check size={16} className="text-dash-success mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-dash-cream">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="label-mono mb-4">AREAS TO WATCH</h3>
            <ul className="space-y-2">
              {member.areasToWatch.map((area, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-dash-warning mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-dash-cream">{area}</span>
                </li>
              ))}
              {member.areasToWatch.length > 0 && (
                <li className="flex items-start gap-2 mt-3 p-3 bg-dash-gold/10 rounded-lg border border-dash-gold/20">
                  <Lightbulb size={16} className="text-dash-gold mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-dash-gold">Suggestion: Consider wine pairing training</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent Shifts */}
      <Card>
        <CardContent className="p-6">
          <h3 className="label-mono mb-4">RECENT SHIFTS</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dash-border">
                  <th className="text-left py-2 label-mono">DATE</th>
                  <th className="text-left py-2 label-mono">HOURS</th>
                  <th className="text-right py-2 label-mono">COVERS</th>
                  <th className="text-right py-2 label-mono">TIPS</th>
                  <th className="text-right py-2 label-mono">EFFICIENCY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {member.recentShifts.map((shift, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-sm text-dash-cream">{shift.date}</td>
                    <td className="py-3 text-sm text-dash-secondary">{shift.hours}</td>
                    <td className="py-3 text-sm text-dash-cream text-right tabular-nums">{shift.covers}</td>
                    <td className="py-3 text-sm font-medium text-dash-cream text-right tabular-nums">${shift.tips}</td>
                    <td className="py-3 text-right">
                      {shift.efficiency ? (
                        <span className={`text-sm font-medium tabular-nums ${
                          shift.efficiency >= 90 ? 'text-dash-success' :
                          shift.efficiency >= 80 ? 'text-dash-warning' :
                          'text-dash-danger'
                        }`}>
                          {shift.efficiency}%
                        </span>
                      ) : (
                        <span className="text-sm text-dash-tertiary">--</span>
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
