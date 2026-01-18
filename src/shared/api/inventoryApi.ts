// Inventory API for shopping list and stock alerts

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'

export interface ShoppingListItem {
  ingredient_id: string
  name: string
  category: string
  unit: string
  current_stock: number
  par_level: number
  avg_daily_usage: number
  forecast_usage: number
  quantity_to_order: number
  cost_per_unit: number
  total_cost: number
  supplier: string
  urgency: 'high' | 'normal'
}

export interface SupplierGroup {
  supplier_name: string
  items: ShoppingListItem[]
  total_cost: number
}

export interface ShoppingListResponse {
  ingredients: ShoppingListItem[]
  total_items: number
  total_cost: number
  forecast_period_days: number
  by_supplier: SupplierGroup[]
}

export interface StockAlert {
  ingredient_id: string
  name: string
  current_stock: number
  par_level: number
  deficit: number
  unit: string
  urgency: 'critical' | 'warning'
}

export interface StockAlertsResponse {
  restaurant_id: string
  total_alerts: number
  low_stock_items: StockAlert[]
}

export const inventoryApi = {
  getShoppingList: (
    restaurantId?: string,
    forecastDays = 7,
    lookbackDays = 30
  ): Promise<ShoppingListResponse> =>
    apiClient.get(
      ENDPOINTS.inventoryShoppingList(restaurantId || 'default', forecastDays, lookbackDays)
    ),

  getStockAlerts: (restaurantId?: string): Promise<StockAlertsResponse> =>
    apiClient.get(ENDPOINTS.inventoryStockAlerts(restaurantId || 'default')),
}
