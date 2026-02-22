import { useState } from 'react'
import { Card, CardContent } from '../../dashboard/components/shared/Card'
import { Badge } from '../../dashboard/components/shared/Badge'
import { Ban, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react'
import { menuItems, items86d, menuInsight } from '../data/mimosasMockData'

const categoryLabels = { star: 'Star', cow: 'Cash Cow', puzzle: 'Puzzle', dog: 'Dog' }
const categoryColors = { star: 'bg-dash-gold/20 text-dash-gold', cow: 'bg-dash-success/20 text-dash-success', puzzle: 'bg-purple-500/20 text-purple-400', dog: 'bg-dash-danger/20 text-dash-danger' }
const topSellerRankStyles = {
  1: { chip: 'bg-dash-gold/20 text-dash-gold border-dash-gold/30', bar: 'bg-dash-gold' },
  2: { chip: 'bg-dash-cream/15 text-dash-secondary border-dash-border', bar: 'bg-dash-secondary' },
  3: { chip: 'bg-dash-warning/20 text-dash-warning border-dash-warning/30', bar: 'bg-dash-warning' },
}

export default function FakeMenu() {
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filtered = categoryFilter === 'all' ? menuItems : menuItems.filter(i => i.category === categoryFilter)
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
          <h1 className="text-2xl font-bold text-dash-cream">Menu <span className="font-dash-display italic text-dash-gold">Intelligence</span></h1>
          <p className="text-dash-secondary mt-1">Analyze performance and optimize your menu <span className="text-sm text-dash-gold ml-2">· Mimosas Southern Kitchen & Bar</span></p>
        </div>
      </div>

      {/* AI Insight Banner */}
      <Card className="mb-6 border-dash-gold/30 bg-dash-gold/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-dash-gold mt-0.5 flex-shrink-0" />
            <p className="text-sm text-dash-cream leading-relaxed">{menuInsight}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-dash-cream">All Menu Items</h3>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {['all', 'star', 'cow', 'puzzle', 'dog'].map(cat => (
                      <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-dash-gold text-dash-base' : 'bg-dash-cream/10 text-dash-secondary hover:bg-dash-cream/20'}`}>
                        {cat === 'all' ? 'All' : categoryLabels[cat]}
                      </button>
                    ))}
                  </div>
                  <Badge variant="info">{filtered.length} items</Badge>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-dash-border">
                    <th className="pb-3 label-mono text-left">ITEM</th>
                    <th className="pb-3 label-mono text-right">SOLD</th>
                    <th className="pb-3 label-mono text-right">REVENUE</th>
                    <th className="pb-3 label-mono text-right">MARGIN</th>
                    <th className="pb-3 label-mono text-left">CATEGORY</th>
                  </tr></thead>
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
          <Card><CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4"><AlertTriangle size={18} className="text-dash-warning" /><h3 className="font-semibold text-dash-cream">86 Recommendations</h3></div>
            <div className="space-y-3">
              {menuItems.filter(i => i.category === 'dog').map(item => (
                <div key={item.id} className="p-3 bg-dash-warning/10 rounded-lg border border-dash-warning/20">
                  <div className="flex items-center justify-between mb-1"><span className="font-medium text-dash-cream">{item.name}</span><span className="text-xs text-dash-warning">{item.sold} sold</span></div>
                  <p className="text-xs text-dash-secondary">Low sales volume, low margin (${item.margin}/unit)</p>
                </div>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4"><Ban size={18} className="text-dash-danger" /><h3 className="font-semibold text-dash-cream">Currently 86'd</h3><Badge variant="danger">{items86d.length}</Badge></div>
            <div className="space-y-3">
              {items86d.map((item, idx) => (
                <div key={idx} className="p-3 bg-dash-danger/10 rounded-lg border border-dash-danger/20">
                  <span className="font-medium text-dash-cream">{item.name}</span>
                  <p className="text-xs text-dash-secondary mt-1">{item.reason}</p>
                  <p className="text-xs text-dash-tertiary mt-1">Since {item.since}</p>
                </div>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-dash-success" />
                <h3 className="font-semibold text-dash-cream">Top Sellers Today</h3>
              </div>
              <span className="label-mono text-dash-tertiary">BY UNITS SOLD</span>
            </div>
            <div className="space-y-3">
              {topSellersWithMeta.map((item) => {
                const rankStyle = topSellerRankStyles[item.rank] || { chip: 'bg-dash-cream/5 text-dash-tertiary border-dash-border', bar: 'bg-dash-tertiary' }
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
          </CardContent></Card>
        </div>
      </div>
    </div>
  )
}
