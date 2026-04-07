import { MetricCard } from '../../dashboard/components/dashboard/MetricCard'
import { FakeFloorStatus } from '../components/FakeFloorStatus'
import { FakeAlertPanel } from '../components/FakeAlertPanel'
import { FakeStaffLeaderboard } from '../components/FakeStaffLeaderboard'
import { FakeReservationTimeline } from '../components/FakeReservationTimeline'
import { FakeAIInsights } from '../components/FakeAIInsights'
import { FakeWeeklyChart } from '../components/FakeWeeklyChart'
import { Card, CardContent } from '../../dashboard/components/shared/Card'
import { todayMetrics, educationalCards, nightlyRollup } from '../data/mimosasMockData'
import { BookOpen, Sparkles } from 'lucide-react'

export default function FakeDashboard() {
  const metrics = [
    { type: 'revenue', title: 'Revenue', value: todayMetrics.revenue.value, change: todayMetrics.revenue.change, goal: todayMetrics.revenue.goal, format: 'currency' },
    { type: 'covers', title: 'Covers', value: todayMetrics.covers.value, change: todayMetrics.covers.change, goal: todayMetrics.covers.goal },
    { type: 'avgCheck', title: 'Avg Check', value: todayMetrics.avgCheck.value, change: todayMetrics.avgCheck.change, goal: todayMetrics.avgCheck.goal, format: 'currency' },
    { type: 'avgWait', title: 'Avg Wait', value: todayMetrics.avgWait.value, change: todayMetrics.avgWait.change, goal: todayMetrics.avgWait.goal, format: 'time' },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border-dash-gold/30 bg-dash-gold/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl border border-dash-gold/30 bg-dash-gold/15 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-dash-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dash-cream">{nightlyRollup.headline}</h2>
              <p className="mt-2 text-sm leading-relaxed text-dash-secondary">{nightlyRollup.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="glass-card rounded-lg flex">
        {metrics.map((metric) => (<MetricCard key={metric.title} {...metric} />))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 min-h-[400px]"><FakeFloorStatus /></div>
        <div className="lg:col-span-4 min-h-[400px]"><FakeAlertPanel /></div>
        <div className="lg:col-span-5 min-h-[400px]"><FakeStaffLeaderboard /></div>
        <div className="lg:col-span-7 min-h-[400px]"><FakeReservationTimeline /></div>
        <div className="lg:col-span-4 min-h-[400px]"><FakeAIInsights /></div>
        <div className="lg:col-span-8 min-h-[400px]"><FakeWeeklyChart /></div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-dash-cream">End Of Night Summary</h3>
            <p className="text-sm text-dash-secondary mt-1">Utilization, turns, labor, pricing impact, and missed revenue in one place</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {nightlyRollup.metrics.map((metric) => (
            <Card key={metric.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="label-mono">{metric.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-dash-cream">{metric.value}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full border border-dash-gold/30 bg-dash-gold/10 text-[11px] font-semibold text-dash-gold">
                    {metric.delta}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-dash-secondary">{metric.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-dash-cream mb-4">Reference</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {educationalCards.map((card) => (
            <Card key={card.id} hover className="overflow-hidden">
              <div className="h-32 bg-dash-base flex items-center justify-center overflow-hidden soft-divider-bottom">
                <BookOpen size={24} className="text-dash-tertiary" />
              </div>
              <CardContent className="p-4">
                <h4 className="font-semibold text-dash-cream text-sm mb-1">{card.title}</h4>
                <p className="text-xs text-dash-secondary leading-relaxed">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
