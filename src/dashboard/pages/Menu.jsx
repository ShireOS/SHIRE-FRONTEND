import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { MenuMatrix } from '../components/menu/MenuMatrix'
import { Sparkles, Ban, Edit3, TrendingUp, TrendingDown, Star, Beef, PuzzleIcon, Dog, AlertTriangle } from 'lucide-react'
import { menuItems, items86d, menuInsight } from '../data/mockData'

const categoryBadges = {
  star: { label: 'Star', variant: 'warning', icon: Star },
  cow: { label: 'Cash Cow', variant: 'success', icon: Beef },
  puzzle: { label: 'Puzzle', variant: 'info', icon: PuzzleIcon },
  dog: { label: 'Dog', variant: 'default', icon: Dog }
}

export function Menu() {
  // Sort menu items by revenue descending
  const sortedItems = [...menuItems].sort((a, b) => b.revenue - a.revenue)

  // Top sellers today (top 5 by sold count)
  const topSellers = [...menuItems].sort((a, b) => b.sold - a.sold).slice(0, 5)

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Intelligence</h1>
          <p className="text-gray-600 mt-1">Analyze performance and optimize your menu</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={<Ban size={18} />}>
            86 Item
          </Button>
          <Button icon={<Edit3 size={18} />}>
            Edit Menu
          </Button>
        </div>
      </div>

      {/* AI Insight Banner */}
      <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Menu Insight</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{menuInsight}</p>
              <div className="flex items-center gap-3 mt-3">
                <Button size="sm">Add Chef Recommends Tag</Button>
                <Button variant="ghost" size="sm">Dismiss</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Menu Engineering Matrix */}
          <MenuMatrix />

          {/* Menu Items Table */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">All Menu Items</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">This Month</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="pb-3 font-medium">Item</th>
                      <th className="pb-3 font-medium text-right">Sold</th>
                      <th className="pb-3 font-medium text-right">Revenue</th>
                      <th className="pb-3 font-medium text-right">Margin</th>
                      <th className="pb-3 font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedItems.map((item) => {
                      const catConfig = categoryBadges[item.category]
                      const CategoryIcon = catConfig.icon
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3">
                            <span className="font-medium text-gray-900">{item.name}</span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-gray-700">{item.sold}</span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="font-medium text-gray-900">${item.revenue}</span>
                          </td>
                          <td className="py-3 text-right">
                            <span className={`font-medium ${item.margin >= 15 ? 'text-green-600' : item.margin >= 10 ? 'text-gray-700' : 'text-amber-600'}`}>
                              ${item.margin}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5">
                              <CategoryIcon size={14} className={
                                item.category === 'star' ? 'text-amber-500' :
                                item.category === 'cow' ? 'text-green-500' :
                                item.category === 'puzzle' ? 'text-purple-500' :
                                'text-gray-400'
                              } />
                              <span className="text-sm text-gray-600">{catConfig.label}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - 1 column */}
        <div className="space-y-6">
          {/* 86'd Items */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Ban size={18} className="text-red-500" />
                <h3 className="font-semibold text-gray-900">Currently 86'd</h3>
              </div>

              {items86d.length > 0 ? (
                <div className="space-y-3">
                  {items86d.map((item, idx) => (
                    <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-700">
                          Restore
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.reason} · Since {item.since}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No items currently 86'd</p>
              )}

              <Button variant="outline" className="w-full mt-4" size="sm" icon={<Ban size={14} />}>
                86 an Item
              </Button>
            </CardContent>
          </Card>

          {/* Top Sellers Today */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-green-500" />
                <h3 className="font-semibold text-gray-900">Top Sellers Today</h3>
              </div>

              <div className="space-y-3">
                {topSellers.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-amber-100 text-amber-700' :
                        idx === 1 ? 'bg-gray-100 text-gray-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-sm text-gray-900">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">{item.sold} sold</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Category Breakdown</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-amber-500" />
                    <span className="text-sm text-gray-700">Stars</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {menuItems.filter(i => i.category === 'star').length} items
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Beef size={16} className="text-green-500" />
                    <span className="text-sm text-gray-700">Cash Cows</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {menuItems.filter(i => i.category === 'cow').length} items
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PuzzleIcon size={16} className="text-purple-500" />
                    <span className="text-sm text-gray-700">Puzzles</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {menuItems.filter(i => i.category === 'puzzle').length} items
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dog size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-700">Dogs</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {menuItems.filter(i => i.category === 'dog').length} items
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total Revenue</span>
                  <span className="font-semibold text-gray-900">
                    ${menuItems.reduce((sum, i) => sum + i.revenue, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500">Avg Margin</span>
                  <span className="font-semibold text-green-600">
                    ${(menuItems.reduce((sum, i) => sum + i.margin, 0) / menuItems.length).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
