import { useParams, useNavigate } from 'react-router-dom'
import { FakeStaffTable } from '../components/FakeStaffTable'
import { Card, CardContent } from '../../dashboard/components/shared/Card'
import { Badge } from '../../dashboard/components/shared/Badge'
import { Button } from '../../dashboard/components/shared/Button'
import { ArrowLeft, Star, AlertTriangle, Edit, MessageSquare, Calendar, Check, Lightbulb } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { staff } from '../data/mimosasMockData'
import { UserPlus } from 'lucide-react'

export default function FakeStaff() {
  const { id } = useParams()
  const navigate = useNavigate()

  if (id) {
    const member = staff.find(s => s.id === id)
    if (!member) {
      return (
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/staff')} className="flex items-center gap-2 text-sm text-dash-secondary hover:text-dash-cream mb-6 transition-colors"><ArrowLeft size={18} />Back to Staff</button>
          <Card><CardContent className="p-8 text-center"><p className="text-dash-tertiary">Staff member not found</p></CardContent></Card>
        </div>
      )
    }

    const chartTheme = {
      axis: 'var(--dash-chart-axis)',
      accent: 'var(--dash-chart-accent-line)',
    }

    const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        return (<div className="glass-card p-3"><p className="text-sm font-medium text-dash-cream mb-1">{label}</p>{payload.map((entry, idx) => (<p key={idx} className="text-sm" style={{ color: entry.color }}>{entry.name === 'tips' ? 'Tips' : 'Efficiency'}: {entry.name === 'tips' ? `$${entry.value}` : `${entry.value}%`}</p>))}</div>)
      }
      return null
    }

    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/staff')} className="flex items-center gap-2 text-sm text-dash-secondary hover:text-dash-cream mb-6 transition-colors"><ArrowLeft size={18} />Back to Staff</button>
        <Card className="mb-6"><CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 bg-dash-gold/20 border border-dash-gold/30 rounded-2xl flex items-center justify-center text-2xl font-semibold text-dash-gold">{member.name.split(' ').map(n => n[0]).join('')}</div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-dash-cream">{member.name}</h1>
                {member.badges.includes('topPerformer') && <Badge variant="success" dot>Top Performer</Badge>}
                {member.badges.includes('new') && <Badge variant="purple" dot>New Hire</Badge>}
              </div>
              <p className="text-dash-secondary">{member.role} · {member.tenure}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" icon={<Edit size={16} />}>Edit</Button>
              <Button variant="outline" size="sm" icon={<MessageSquare size={16} />}>Message</Button>
              <Button variant="outline" size="sm" icon={<Calendar size={16} />}>Schedule</Button>
            </div>
          </div>
        </CardContent></Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card><CardContent className="p-6"><h3 className="label-mono mb-4">THIS MONTH</h3><div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm text-dash-tertiary mb-1">Covers</p><p className="text-2xl font-bold text-dash-cream tabular-nums">{member.thisMonth.covers}</p></div>
            <div><p className="text-sm text-dash-tertiary mb-1">Tips</p><p className="text-2xl font-bold text-dash-cream tabular-nums">${member.thisMonth.tips.toLocaleString()}</p></div>
            <div><p className="text-sm text-dash-tertiary mb-1">Avg/Cover</p><p className="text-2xl font-bold text-dash-cream tabular-nums">${member.thisMonth.avgTip.toFixed(2)}</p></div>
            <div><p className="text-sm text-dash-tertiary mb-1">Efficiency</p><p className={`text-2xl font-bold tabular-nums ${member.thisMonth.efficiency >= 90 ? 'text-dash-success' : member.thisMonth.efficiency >= 80 ? 'text-dash-warning' : member.thisMonth.efficiency ? 'text-dash-danger' : 'text-dash-tertiary'}`}>{member.thisMonth.efficiency ? `${member.thisMonth.efficiency}%` : '--'}</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-6"><h3 className="label-mono mb-4">6 MONTH TREND</h3>
            {member.trendData.length > 0 ? (
              <div className="h-32 bg-dash-base rounded-lg p-2 border border-dash-border"><ResponsiveContainer width="100%" height="100%"><LineChart data={member.trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chartTheme.axis }} /><YAxis hide /><Tooltip content={<CustomTooltip />} /><Line type="monotone" dataKey="tips" stroke={chartTheme.accent} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
            ) : (<div className="h-32 flex items-center justify-center text-sm text-dash-tertiary bg-dash-base rounded-lg border border-dash-border">Not enough data yet</div>)}
          </CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card><CardContent className="p-6"><h3 className="label-mono mb-4">STRENGTHS</h3><ul className="space-y-2">{member.strengths.map((s, idx) => (<li key={idx} className="flex items-start gap-2"><Check size={16} className="text-dash-success mt-0.5 flex-shrink-0" /><span className="text-sm text-dash-cream">{s}</span></li>))}</ul></CardContent></Card>
          <Card><CardContent className="p-6"><h3 className="label-mono mb-4">AREAS TO WATCH</h3><ul className="space-y-2">{member.areasToWatch.map((a, idx) => (<li key={idx} className="flex items-start gap-2"><AlertTriangle size={16} className="text-dash-warning mt-0.5 flex-shrink-0" /><span className="text-sm text-dash-cream">{a}</span></li>))}{member.areasToWatch.length > 0 && (<li className="flex items-start gap-2 mt-3 p-3 bg-dash-gold/10 rounded-lg border border-dash-gold/20"><Lightbulb size={16} className="text-dash-gold mt-0.5 flex-shrink-0" /><span className="text-sm text-dash-gold">Suggestion: Focus on upselling mimosa flights during peak brunch</span></li>)}</ul></CardContent></Card>
        </div>

        <Card><CardContent className="p-6"><h3 className="label-mono mb-4">RECENT SHIFTS</h3><div className="overflow-x-auto"><table className="w-full"><thead><tr className="soft-table-head"><th className="text-left py-2 label-mono">DATE</th><th className="text-left py-2 label-mono">HOURS</th><th className="text-right py-2 label-mono">COVERS</th><th className="text-right py-2 label-mono">TIPS</th><th className="text-right py-2 label-mono">EFFICIENCY</th></tr></thead><tbody className="soft-divider-y">{member.recentShifts.map((shift, idx) => (<tr key={idx} className="soft-table-row"><td className="py-3 text-sm text-dash-cream">{shift.date}</td><td className="py-3 text-sm text-dash-secondary">{shift.hours}</td><td className="py-3 text-sm text-dash-cream text-right tabular-nums">{shift.covers}</td><td className="py-3 text-sm font-medium text-dash-cream text-right tabular-nums">${shift.tips}</td><td className="py-3 text-right">{shift.efficiency ? (<span className={`text-sm font-medium tabular-nums ${shift.efficiency >= 90 ? 'text-dash-success' : shift.efficiency >= 80 ? 'text-dash-warning' : 'text-dash-danger'}`}>{shift.efficiency}%</span>) : (<span className="text-sm text-dash-tertiary">--</span>)}</td></tr>))}</tbody></table></div></CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dash-cream"><span className="font-dash-display italic text-dash-gold">Staff</span></h1>
          <p className="text-dash-secondary mt-1">Manage your team and track performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={<Calendar size={18} />}>View Schedule</Button>
          <Button icon={<UserPlus size={18} />}>Add Staff</Button>
        </div>
      </div>
      <FakeStaffTable />
    </div>
  )
}
