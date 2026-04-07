import { useState } from 'react'
import { Card, CardContent } from '../../dashboard/components/shared/Card'
import { Badge } from '../../dashboard/components/shared/Badge'
import { Ban, TrendingUp, Sparkles, ArrowUpRight, ArrowDownRight, Timer } from 'lucide-react'
import {
  menuItems,
  items86d,
  pricingRecommendations,
  pricingSummary,
} from '../data/mimosasMockData'

const categoryLabels = { star: 'Star', cow: 'Cash Cow', puzzle: 'Puzzle', dog: 'Dog' }
const categoryColors = {
  star: 'bg-dash-gold/20 text-dash-gold',
  cow: 'bg-dash-success/20 text-dash-success',
  puzzle: 'bg-sky-500/20 text-sky-300',
  dog: 'bg-dash-danger/20 text-dash-danger',
}
const topSellerRankStyles = {
  1: { chip: 'bg-dash-gold/20 text-dash-gold border-dash-gold/30', bar: 'bg-dash-gold' },
  2: { chip: 'bg-dash-cream/15 text-dash-secondary border-dash-border', bar: 'bg-dash-secondary' },
  3: { chip: 'bg-dash-warning/20 text-dash-warning border-dash-warning/30', bar: 'bg-dash-warning' },
}

export default function FakeMenu() {
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filtered = categoryFilter === 'all' ? menuItems : menuItems.filter((item) => item.category === categoryFilter)
  const topSellers = [...menuItems].sort((a, b) => b.sold - a.sold).slice(0, 5)
  const maxSold = Math.max(...menuItems.map((item) => item.sold))
  const soldRankLookup = new Map([...menuItems].sort((a, b) => b.sold - a.sold).map((item, idx) => [item.id, idx + 1]))
  const topSellerTotalSold = topSellers.reduce((sum, item) => sum + item.sold, 0)
  const topSellersWithMeta = topSellers.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    soldShare: topSellerTotalSold > 0 ? Math.round((item.sold / topSellerTotalSold) * 100) : 0,
    score: maxSold > 0 ? Math.round((item.sold / maxSold) * 100) : 0,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dash-cream">Pricing Recommendations</h1>
          <p className="text-dash-secondary mt-1">Suggested menu moves based on floor turns, POS mix, reservations, and staffing</p>
        </div>
        <Badge variant="info">Offline demo</Badge>
      </div>

      <Card className="mb-6 border-dash-gold/30 bg-dash-gold/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl border border-dash-gold/30 bg-dash-gold/15 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-dash-gold" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-dash-cream">{pricingSummary.title}</h2>
                <Badge variant="success">Est. +${pricingSummary.weeklyLift}/week</Badge>
                <Badge variant="warning">{pricingSummary.sameStaffLift}% pace lift</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-dash-secondary">{pricingSummary.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {pricingSummary.monitoredSignals.map((signal) => (
                  <span key={signal} className="px-2.5 py-1 rounded-full border border-dash-border bg-dash-cream/5 text-xs text-dash-secondary">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-dash-cream">Recommended Pricing Moves</h3>
                  <p className="text-sm text-dash-secondary mt-1">Small changes tied to current demand, open capacity, and server load</p>
                </div>
                <Badge variant="info">{pricingRecommendations.length} active</Badge>
              </div>

              <div className="space-y-4">
                {pricingRecommendations.map((recommendation) => (
                  <PricingRecommendationCard key={recommendation.id} recommendation={recommendation} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-dash-success" />
                <h3 className="font-semibold text-dash-cream">What This Adds Up To</h3>
              </div>
              <div className="space-y-4">
                <MetricRow label="Weekly pricing lift" value={`+$${pricingSummary.weeklyLift}`} tone="success" />
                <MetricRow label="Pace lift" value={`+${pricingSummary.sameStaffLift}%`} tone="gold" />
                <MetricRow label="Decision basis" value="Floor + POS" tone="neutral" />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-dash-secondary">
                These suggestions are tied to the same floor state used by seating, so pricing follows actual turns and capacity instead of static daypart rules.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Ban size={18} className="text-dash-danger" />
                <h3 className="font-semibold text-dash-cream">Currently 86&apos;d</h3>
                <Badge variant="danger">{items86d.length}</Badge>
              </div>
              <div className="space-y-3">
                {items86d.map((item, idx) => (
                  <div key={idx} className="p-3 bg-dash-danger/10 rounded-lg border border-dash-danger/20">
                    <span className="font-medium text-dash-cream">{item.name}</span>
                    <p className="text-xs text-dash-secondary mt-1">{item.reason}</p>
                    <p className="text-xs text-dash-tertiary mt-1">Since {item.since}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-dash-cream">All Menu Items</h3>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {['all', 'star', 'cow', 'puzzle', 'dog'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                          categoryFilter === cat
                            ? 'bg-dash-gold text-dash-base'
                            : 'bg-dash-cream/10 text-dash-secondary hover:bg-dash-cream/20'
                        }`}
                      >
                        {cat === 'all' ? 'All' : categoryLabels[cat]}
                      </button>
                    ))}
                  </div>
                  <Badge variant="info">{filtered.length} items</Badge>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dash-border">
                      <th className="pb-3 label-mono text-left">ITEM</th>
                      <th className="pb-3 label-mono text-right">SOLD</th>
                      <th className="pb-3 label-mono text-right">REVENUE</th>
                      <th className="pb-3 label-mono text-right">MARGIN</th>
                      <th className="pb-3 label-mono text-left">CATEGORY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-border">
                    {filtered.map((item) => (
                      <tr key={item.id} className="group hover:bg-dash-cream/5 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] label-mono text-dash-tertiary">#{soldRankLookup.get(item.id)}</span>
                            <span className="font-medium text-dash-cream">{item.name}</span>
                            <span className="text-xs text-dash-tertiary">${item.price}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2 min-w-[72px]">
                            <span className="text-dash-secondary tabular-nums">{item.sold}</span>
                            <span className="w-9 h-1 rounded-full bg-dash-cream/10 overflow-hidden soft-progress-track">
                              <span
                                className="h-full rounded-full bg-dash-gold/70 block transition-all duration-300 group-hover:bg-dash-gold"
                                style={{ width: `${Math.max(8, Math.round((item.sold / maxSold) * 100))}%` }}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right"><span className="font-medium text-dash-cream">${item.revenue}</span></td>
                        <td className="py-3 text-right"><span className={`font-medium ${item.margin >= 10 ? 'text-dash-success' : item.margin >= 7 ? 'text-dash-secondary' : 'text-dash-warning'}`}>${item.margin}</span></td>
                        <td className="py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[item.category]}`}>{categoryLabels[item.category]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-dash-success" />
                  <h3 className="font-semibold text-dash-cream">Top Sellers Today</h3>
                </div>
                <span className="label-mono text-dash-tertiary">BY UNITS SOLD</span>
              </div>
              <div className="space-y-3">
                {topSellersWithMeta.map((item) => {
                  const rankStyle = topSellerRankStyles[item.rank] || {
                    chip: 'bg-dash-cream/5 text-dash-tertiary border-dash-border',
                    bar: 'bg-dash-tertiary',
                  }
                  return (
                    <div key={item.id} className="group p-3 rounded-lg border border-transparent bg-dash-cream/5 hover:bg-dash-cream/10 hover:border-dash-gold/20 transition-all duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-7 h-7 rounded-md border flex items-center justify-center text-xs font-bold tabular-nums ${rankStyle.chip}`}>{item.rank}</span>
                          <div className="min-w-0">
                            <p className="text-sm text-dash-cream truncate">{item.name}</p>
                            <p className="text-[11px] text-dash-tertiary">{categoryLabels[item.category]}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-dash-cream tabular-nums">{item.sold} sold</p>
                          <p className="text-[11px] text-dash-tertiary">{item.soldShare}% of top 5</p>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-dash-cream/10 overflow-hidden soft-progress-track">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${rankStyle.bar}`}
                          style={{ width: `${Math.max(10, item.score)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PricingRecommendationCard({ recommendation }) {
  const isIncrease = recommendation.mode === 'increase'
  const isDecrease = recommendation.mode === 'decrease'
  const pillTone = isIncrease
    ? 'bg-dash-success/15 border-dash-success/30 text-dash-success'
    : isDecrease
      ? 'bg-dash-warning/15 border-dash-warning/30 text-dash-warning'
      : 'bg-dash-gold/15 border-dash-gold/30 text-dash-gold'

  return (
    <div className="rounded-xl border border-dash-border bg-dash-cream/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-dash-cream">{recommendation.item}</h4>
            <span className={`px-2 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wide ${pillTone}`}>
              {recommendation.mode === 'bundle' ? 'Bundle' : isIncrease ? 'Raise price' : 'Lower price'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-dash-secondary">{recommendation.reason}</p>
        </div>
        <div className="rounded-xl border border-dash-border bg-dash-base px-4 py-3 min-w-[150px]">
          <div className="text-[10px] uppercase tracking-[0.2em] text-dash-tertiary">Recommended move</div>
          <div className="mt-2 flex items-center gap-2">
            {recommendation.mode === 'bundle' ? (
              <span className="text-xl font-semibold text-dash-cream">${recommendation.nextPrice}</span>
            ) : (
              <>
                <span className="text-sm text-dash-tertiary line-through">${recommendation.currentPrice?.toFixed(2)}</span>
                {isIncrease ? <ArrowUpRight size={16} className="text-dash-success" /> : <ArrowDownRight size={16} className="text-dash-warning" />}
                <span className="text-xl font-semibold text-dash-cream">${recommendation.nextPrice?.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <InfoTile label="Window" value={recommendation.window} icon={<Timer size={14} className="text-dash-secondary" />} />
        <InfoTile label="Expected lift" value={`+$${recommendation.expectedLift}/wk`} icon={<TrendingUp size={14} className="text-dash-success" />} />
        <InfoTile label="Signal" value={recommendation.signal} icon={<Sparkles size={14} className="text-dash-gold" />} />
      </div>
    </div>
  )
}

function InfoTile({ label, value, icon }) {
  return (
    <div className="rounded-lg border border-dash-border bg-dash-base/70 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-dash-tertiary">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm text-dash-cream leading-relaxed">{value}</p>
    </div>
  )
}

function MetricRow({ label, value, tone }) {
  const toneClass = tone === 'success'
    ? 'text-dash-success'
    : tone === 'gold'
      ? 'text-dash-gold'
      : 'text-dash-cream'

  return (
    <div className="flex items-center justify-between border-b border-dash-border pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-dash-secondary">{label}</span>
      <span className={`text-base font-semibold ${toneClass}`}>{value}</span>
    </div>
  )
}
