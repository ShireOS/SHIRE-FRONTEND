import { useState, useEffect } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { Ban, AlertTriangle, TrendingUp, TrendingDown, Loader2, ShoppingCart, X, Minus, Trash2 } from 'lucide-react'
import {
  useMenuTopRankings,
  useMenuBottomRankings,
  useMenu86Recommendations,
  useMenu86dItems,
  useRestaurants,
  usePricingRecommendations,
} from '../../shared/hooks/useMenuAnalytics'
import { menuApi } from '../../shared/api/menuApi'
import { API_CONFIG } from '../../shared/api/config'
import { useShoppingList } from '../../shared/hooks/useInventory'

// Score Badge Component
function ScoreBadge({ score }) {
  const getColor = () => {
    if (score >= 70) return 'bg-green-100 text-green-700'
    if (score >= 40) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const getLabel = () => {
    if (score >= 70) return 'Strong'
    if (score >= 40) return 'Average'
    return 'Weak'
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${getColor()}`}>
      {score.toFixed(1)} · {getLabel()}
    </span>
  )
}

export function Menu() {
  const [restaurantId, setRestaurantId] = useState(API_CONFIG.restaurantId)
  const [actionLoading, setActionLoading] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)

  // Fetch restaurants
  const { data: restaurants } = useRestaurants()

  // Auto-select Mimosas on first load
  useEffect(() => {
    if (restaurants) {
      const mimosas = restaurants.find((r) => r.name === 'Mimosas')
      if (mimosas) {
        console.log('[Menu] Auto-selecting Mimosas restaurant:', mimosas.id)
        setRestaurantId(mimosas.id)
        localStorage.setItem('selectedRestaurantId', mimosas.id)
      }
    }
  }, [restaurants])

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedRestaurantId')
    if (saved) {
      setRestaurantId(saved)
    }
  }, [])

  // Fetch menu data
  const {
    data: topRankings,
    loading: loadingTop,
    error: errorTop,
    refetch: refetchTop,
  } = useMenuTopRankings(restaurantId, 30, 20)

  const {
    data: bottomRankings,
    loading: loadingBottom,
    error: errorBottom,
  } = useMenuBottomRankings(restaurantId, 30, 10)

  const {
    data: recommendations,
    refetch: refetchRecs,
  } = useMenu86Recommendations(restaurantId, 30, 25)

  const { data: items86d, refetch: refetch86d } = useMenu86dItems(restaurantId)

  // Fetch shopping list data
  const { data: shoppingList, loading: loadingInventory } = useShoppingList(restaurantId, 7, 30)

  // Fetch pricing recommendations
  const { data: pricingRecs, loading: loadingPricing } = usePricingRecommendations(restaurantId, 30)

  // Log loaded data
  useEffect(() => {
    if (topRankings) {
      console.log('[Menu] Top rankings loaded:', topRankings.items.length, 'items')
    }
    if (bottomRankings) {
      console.log('[Menu] Bottom rankings loaded:', bottomRankings.items.length, 'items')
    }
    if (recommendations) {
      console.log('[Menu] 86 recommendations:', recommendations.total_recommendations)
    }
    if (items86d) {
      console.log('[Menu] Currently 86\'d:', items86d.total_86d, 'items')
    }
  }, [topRankings, bottomRankings, recommendations, items86d])

  // Combine top + bottom for full list
  const allItems = [
    ...(topRankings?.items || []),
    ...(bottomRankings?.items || []),
  ]

  // Top sellers (by times ordered)
  const topSellers = [...allItems].sort((a, b) => b.times_ordered - a.times_ordered).slice(0, 5)

  // Handle 86 action
  const handle86 = async (itemId, itemName) => {
    if (!confirm(`86 "${itemName}"? This will mark it as unavailable.`)) {
      return
    }

    setActionLoading(true)
    try {
      const result = await menuApi.mark86(restaurantId, itemId)
      console.log('[Menu] 86 result:', result)

      if (result.success) {
        // Refresh all data
        refetchRecs()
        refetch86d()
        refetchTop()
        alert(result.message)
      }
    } catch (err) {
      console.error('[Menu] Failed to 86 item:', err)
      alert('Failed to 86 item. Check console for details.')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Un-86 action
  const handleUn86 = async (itemId, itemName) => {
    if (!confirm(`Restore "${itemName}"?`)) {
      return
    }

    setActionLoading(true)
    try {
      const result = await menuApi.markUn86(restaurantId, itemId)
      console.log('[Menu] Un-86 result:', result)

      if (result.success) {
        refetch86d()
        refetchTop()
        alert(result.message)
      }
    } catch (err) {
      console.error('[Menu] Failed to restore item:', err)
      alert('Failed to restore item. Check console for details.')
    } finally {
      setActionLoading(false)
    }
  }

  // Loading state
  if (loadingTop || loadingBottom) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading menu analytics...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (errorTop || errorBottom) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500 text-center">
          <p className="font-semibold">Error loading menu data</p>
          <p className="text-sm mt-1">Check that backend is running at {API_CONFIG.baseUrl}</p>
        </div>
        <Button
          onClick={() => {
            refetchTop()
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Intelligence</h1>
          <p className="text-gray-600 mt-1">
            Analyze performance and optimize your menu
            {restaurants && (
              <span className="text-sm text-purple-600 ml-2">
                · {restaurants.find((r) => r.id === restaurantId)?.name || 'Loading...'}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Menu Items Table */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">All Menu Items</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Last 30 Days</span>
                  <Badge variant="info">{allItems.length} items</Badge>
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
                      <th className="pb-3 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3">
                          <span className="font-medium text-gray-900">{item.name}</span>
                          {item.category && (
                            <span className="text-xs text-gray-500 ml-2">
                              {item.category}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-gray-700">{item.times_ordered}</span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="font-medium text-gray-900">
                            ${(item.price * item.times_ordered).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`font-medium ${
                              item.margin_pct >= 50
                                ? 'text-green-600'
                                : item.margin_pct >= 30
                                ? 'text-gray-700'
                                : 'text-amber-600'
                            }`}
                          >
                            {item.margin_pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3">
                          <ScoreBadge score={item.combined_score} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - 1 column */}
        <div className="space-y-6">
          {/* 86 Recommendations - Clickable for Pricing Modal */}
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setShowPricingModal(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <h3 className="font-semibold text-gray-900">86 Recommendations</h3>
                </div>
                <span className="text-xs text-gray-400">Click for pricing insights →</span>
              </div>

              {recommendations && recommendations.total_recommendations > 0 ? (
                <div className="space-y-3">
                  {recommendations.recommendations.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-amber-50 rounded-lg border border-amber-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <span className="text-xs text-amber-600">
                          Score: {item.combined_score.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{item.reason}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handle86(item.id, item.name)
                        }}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Processing...' : '86 This Item'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No items recommended for removal</p>
              )}
            </CardContent>
          </Card>

          {/* Currently 86'd Items */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Ban size={18} className="text-red-500" />
                <h3 className="font-semibold text-gray-900">Currently 86'd</h3>
                {items86d && items86d.total_86d > 0 && (
                  <Badge variant="danger">{items86d.total_86d}</Badge>
                )}
              </div>

              {items86d && items86d.total_86d > 0 ? (
                <div className="space-y-3">
                  {items86d.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-red-50 rounded-lg border border-red-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {item.updated_at
                          ? `Since ${new Date(item.updated_at).toLocaleDateString()}`
                          : "Recently 86'd"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-red-600 hover:text-red-700"
                        onClick={() => handleUn86(item.id, item.name)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Processing...' : 'Restore Item'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No items currently 86'd</p>
              )}
            </CardContent>
          </Card>

          {/* Top Sellers Today */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-green-500" />
                <h3 className="font-semibold text-gray-900">Top Sellers (30d)</h3>
              </div>

              <div className="space-y-3">
                {topSellers.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-700'
                            : idx === 1
                            ? 'bg-gray-100 text-gray-700'
                            : idx === 2
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-50 text-gray-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm text-gray-900">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {item.times_ordered} sold
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Optimized Restock */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-emerald-500" />
                  <h3 className="font-semibold text-gray-900">Optimized Restock</h3>
                </div>
                {shoppingList && (
                  <Badge variant="success">{shoppingList.total_items} items</Badge>
                )}
              </div>

              {loadingInventory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-gray-400" size={20} />
                </div>
              ) : shoppingList && shoppingList.ingredients.length > 0 ? (
                <>
                  {/* Total Cost Summary */}
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-600">Optimized Order</span>
                        <p className="text-xs text-gray-500">
                          {shoppingList.forecast_period_days}-day forecast based on sales
                        </p>
                      </div>
                      <span className="text-lg font-bold text-emerald-700">
                        ${shoppingList.total_cost.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Ingredient List */}
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {shoppingList.ingredients.slice(0, 8).map((item) => {
                      // Calculate days left and stock percentage
                      const daysLeft = item.avg_daily_usage > 0
                        ? Math.floor(item.current_stock / item.avg_daily_usage)
                        : 99
                      const stockPct = Math.min((item.current_stock / item.par_level) * 100, 100)
                      const barColor = stockPct < 25
                        ? 'bg-red-500'
                        : stockPct < 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'

                      return (
                        <div
                          key={item.ingredient_id}
                          className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm"
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              {item.name}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              daysLeft <= 2
                                ? 'bg-red-100 text-red-700'
                                : daysLeft <= 5
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {daysLeft <= 0 ? 'Out' : `${daysLeft}d left`}
                            </span>
                          </div>

                          {/* Stock level bar */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>Stock: {item.current_stock.toFixed(1)} / {item.par_level} {item.unit}</span>
                              <span>{Math.round(stockPct)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor} rounded-full transition-all`}
                                style={{ width: `${stockPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Order details */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">
                              Order {item.quantity_to_order.toFixed(1)} {item.unit}
                            </span>
                            <span className="font-medium text-gray-700">
                              ${item.total_cost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {shoppingList.ingredients.length > 8 && (
                    <p className="text-xs text-gray-500 text-center mt-3">
                      +{shoppingList.ingredients.length - 8} more items
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Stock levels optimal</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pricing Recommendations Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Menu Optimization</h2>
                <p className="text-sm text-gray-500">AI-powered pricing recommendations</p>
              </div>
              <button
                onClick={() => setShowPricingModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingPricing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : pricingRecs?.recommendations?.length > 0 ? (
                <div className="space-y-3">
                  {pricingRecs.recommendations.map((rec) => (
                    <div
                      key={rec.item_id}
                      className={`p-4 rounded-lg border ${
                        rec.action === 'increase'
                          ? 'bg-green-50 border-green-200'
                          : rec.action === 'decrease'
                          ? 'bg-amber-50 border-amber-200'
                          : rec.action === 'remove'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {rec.action === 'increase' && (
                              <TrendingUp size={16} className="text-green-600" />
                            )}
                            {rec.action === 'decrease' && (
                              <TrendingDown size={16} className="text-amber-600" />
                            )}
                            {rec.action === 'remove' && (
                              <Trash2 size={16} className="text-red-600" />
                            )}
                            {rec.action === 'maintain' && (
                              <Minus size={16} className="text-gray-600" />
                            )}
                            <span className="font-medium text-gray-900">{rec.item_name}</span>
                            <span className="text-xs text-gray-500">{rec.category}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{rec.reason}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            ${rec.current_price.toFixed(2)}
                          </div>
                          {rec.suggested_price &&
                            rec.suggested_price !== rec.current_price && (
                              <div
                                className={`font-semibold ${
                                  rec.action === 'increase'
                                    ? 'text-green-600'
                                    : rec.action === 'decrease'
                                    ? 'text-amber-600'
                                    : 'text-gray-600'
                                }`}
                              >
                                → ${rec.suggested_price.toFixed(2)}
                              </div>
                            )}
                        </div>
                      </div>
                      {rec.expected_revenue_impact && (
                        <div className="mt-2 text-xs text-gray-500">
                          Expected impact:{' '}
                          <span className="font-medium text-green-600">
                            {rec.expected_revenue_impact}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">All items are optimally priced</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Based on {pricingRecs?.analysis_period_days || 30}-day sales analysis
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
