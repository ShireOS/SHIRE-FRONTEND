import { MetricCard } from '../components/dashboard/MetricCard'
import { FloorStatus } from '../components/dashboard/FloorStatus'
import { AlertsPanel } from '../components/dashboard/AlertsPanel'
import { StaffLeaderboard } from '../components/dashboard/StaffLeaderboard'
import { ReservationTimeline } from '../components/dashboard/ReservationTimeline'
import { AIInsights } from '../components/dashboard/AIInsights'
import { WeeklyChart } from '../components/dashboard/WeeklyChart'
import { Card, CardContent } from '../components/shared/Card'
import { todayMetrics, educationalCards } from '../data/mockData'
import { BookOpen } from 'lucide-react'

export function Dashboard() {
  const metrics = [
    {
      type: 'revenue',
      title: 'Revenue',
      value: todayMetrics.revenue.value,
      change: todayMetrics.revenue.change,
      goal: todayMetrics.revenue.goal,
      format: 'currency'
    },
    {
      type: 'covers',
      title: 'Covers',
      value: todayMetrics.covers.value,
      change: todayMetrics.covers.change,
      goal: todayMetrics.covers.goal
    },
    {
      type: 'avgCheck',
      title: 'Avg Check',
      value: todayMetrics.avgCheck.value,
      change: todayMetrics.avgCheck.change,
      goal: todayMetrics.avgCheck.goal,
      format: 'currency'
    },
    {
      type: 'avgWait',
      title: 'Avg Wait',
      value: todayMetrics.avgWait.value,
      change: todayMetrics.avgWait.change,
      goal: todayMetrics.avgWait.goal,
      format: 'time'
    }
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor Status - 2 cols */}
        <div className="lg:col-span-2 min-h-[400px]">
          <FloorStatus />
        </div>

        {/* Alerts Panel - 1 col */}
        <div className="min-h-[400px]">
          <AlertsPanel />
        </div>

        {/* Staff Leaderboard - 1 col */}
        <div className="min-h-[400px]">
          <StaffLeaderboard />
        </div>

        {/* Reservation Timeline - 2 cols */}
        <div className="lg:col-span-2 min-h-[400px]">
          <ReservationTimeline />
        </div>

        {/* AI Insights - 1 col */}
        <div className="min-h-[400px]">
          <AIInsights />
        </div>

        {/* Weekly Chart - 2 cols */}
        <div className="lg:col-span-2 min-h-[400px]">
          <WeeklyChart />
        </div>
      </div>

      {/* Row 5: Educational Cards */}
      <div>
        <h3 className="text-lg font-semibold text-primary mb-4">Learn & Optimize</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {educationalCards.map((card) => {
            const cardImage = card.title === 'Maximizing Tips' ? '/tips.png'
              : card.title === 'Optimizing Your Team' ? '/team.png'
                : card.title === 'Peak Hour Strategies' ? '/hours.png'
                  : card.title === 'Understanding Turn Times' ? '/time.png'
                    : null;

            return (
              <Card key={card.id} hover className="overflow-hidden bg-surface border-border shadow-card">
                {/* Image */}
                <div className="h-32 bg-sidebar flex items-center justify-center overflow-hidden border-b border-border">
                  {cardImage ? (
                    <img src={cardImage} alt={card.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={24} className="text-secondary" />
                  )}
                </div>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-primary text-sm mb-1">{card.title}</h4>
                  <p className="text-xs text-secondary leading-relaxed">{card.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  )
}
