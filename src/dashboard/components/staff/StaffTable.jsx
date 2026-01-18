import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../shared/Card'
import { Badge } from '../shared/Badge'
import { Button } from '../shared/Button'
import {
  Search,
  ChevronDown,
  ChevronUp,
  Star,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  WifiOff
} from 'lucide-react'
import { useWaiterList } from '../../../shared/hooks/useWaiterList'
import { useRestaurants } from '../../../shared/hooks/useMenuAnalytics'
import { API_CONFIG } from '../../../shared/api/config'

export function StaffTable() {
  const navigate = useNavigate()

  // Auto-select first restaurant (which is Mimosas)
  const [restaurantId, setRestaurantId] = useState(null)
  const { data: restaurants } = useRestaurants()

  useEffect(() => {
    if (restaurants && restaurants.length > 0) {
      // LOG ALL AVAILABLE RESTAURANTS
      console.group('[StaffTable] 🏢 Available Restaurants')
      console.log('Total Restaurants:', restaurants.length)
      console.table(restaurants.map(r => ({
        id: r.id,
        name: r.name,
      })))
      console.groupEnd()

      // SELECT FIRST RESTAURANT (Mimosas)
      const selectedRestaurant = restaurants[0]
      console.log('[StaffTable] 🎯 Auto-selecting FIRST restaurant:', selectedRestaurant.name, selectedRestaurant.id)
      setRestaurantId(selectedRestaurant.id)
    }
  }, [restaurants])

  // Use SAME pattern as Schedule.jsx - useWaiterList hook
  const { data: allStaff, loading: isLoading, error } = useWaiterList(restaurantId)

  // Only show servers in staff table (servers are the ones with tips/performance metrics)
  const staff = (allStaff || []).filter((s) => s.role.toLowerCase() === 'server')

  const isError = !!error
  const refetch = () => window.location.reload() // Simple refetch for error state

  const [sortField, setSortField] = useState('tips')
  const [sortDir, setSortDir] = useState('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Compute filtered staff (must be before any early returns!)
  const filteredStaff = staff
    .filter(member => {
      if (searchQuery && !member.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (roleFilter !== 'all' && member.role !== roleFilter) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      let aVal, bVal
      if (sortField === 'tips') {
        aVal = a.thisMonth.tips
        bVal = b.thisMonth.tips
      } else if (sortField === 'covers') {
        aVal = a.thisMonth.covers
        bVal = b.thisMonth.covers
      } else if (sortField === 'efficiency') {
        aVal = a.thisMonth.efficiency || 0
        bVal = b.thisMonth.efficiency || 0
      } else if (sortField === 'name') {
        aVal = a.name
        bVal = b.name
      }
      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

  // ENHANCED LOGGING - Track staff data flow through component (BEFORE early returns!)
  useEffect(() => {
    if (allStaff && allStaff.length > 0) {
      console.group('[StaffTable] 📊 Data Flow Analysis')
      console.log('Total staff from API (allStaff):', allStaff.length)
      console.log('After server-only filter (staff):', staff.length)

      // Show role breakdown
      const roleBreakdown = allStaff.reduce((acc, s) => {
        acc[s.role] = (acc[s.role] || 0) + 1
        return acc
      }, {})
      console.log('Role Breakdown:', roleBreakdown)

      // Log all staff in a table
      console.table(
        allStaff.map((s) => ({
          id: s.id.slice(0, 8),
          name: s.name,
          role: s.role,
          tips: s.thisMonth.tips,
          covers: s.thisMonth.covers,
          tenure: s.tenure,
        }))
      )

      console.groupEnd()
    }
  }, [allStaff, staff])

  // ENHANCED LOGGING - Track filtering impact (BEFORE early returns!)
  useEffect(() => {
    if (staff.length > 0) {
      console.group('[StaffTable] 🔍 Filter Impact')
      console.log('Before filters:', staff.length)
      console.log('After search + role filters (filteredStaff):', filteredStaff.length)
      console.log('Active Filters:', {
        searchQuery: searchQuery || 'none',
        roleFilter: roleFilter,
        sortField: sortField,
        sortDir: sortDir,
      })
      console.log('Final Display Count:', filteredStaff.length, 'staff members')
      console.groupEnd()
    }
  }, [staff, filteredStaff, searchQuery, roleFilter, sortField, sortDir])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Show loading state
  if (!restaurantId || isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {!restaurantId ? 'Loading restaurants...' : 'Loading staff data...'}
          </p>
          <p className="text-sm text-gray-400 mt-1">Connecting to backend API</p>
        </CardContent>
      </Card>
    )
  }

  // Show error state with debugging info
  if (isError) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <WifiOff size={40} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cannot Connect to Backend</h3>
            <p className="text-gray-600 mb-4">{error?.message || 'Unknown error'}</p>

            {/* Debug info */}
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-4 max-w-md mx-auto">
              <p className="text-xs font-mono text-gray-500 mb-1">Debug Info:</p>
              <p className="text-xs font-mono text-gray-700">Status: {error?.status || 'N/A'}</p>
              <p className="text-xs font-mono text-gray-700">Endpoint: {error?.endpoint || 'N/A'}</p>
              {error?.details && (
                <p className="text-xs font-mono text-gray-700 mt-1 break-all">
                  Details: {typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}
                </p>
              )}
            </div>

            <Button onClick={refetch} icon={<RefreshCw size={16} />}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={14} className="text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={14} className="text-blue-600" />
      : <ChevronDown size={14} className="text-blue-600" />
  }

  const TrendIcon = ({ trend }) => {
    if (trend === 'up') return <TrendingUp size={14} className="text-green-500" />
    if (trend === 'down') return <TrendingDown size={14} className="text-red-500" />
    if (trend === 'stable') return <Minus size={14} className="text-gray-400" />
    return <Sparkles size={14} className="text-purple-500" />
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="Server">Servers</option>
            <option value="Busser">Bussers</option>
            <option value="Host">Hosts</option>
          </select>

          {/* Time Filter */}
          <select className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>This Month</option>
            <option>This Week</option>
            <option>Last Month</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('covers')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Covers <SortIcon field="covers" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('tips')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Tips <SortIcon field="tips" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tip %
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('efficiency')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Efficiency <SortIcon field="efficiency" />
                  </div>
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStaff.map((member, idx) => (
                <tr
                  key={member.id}
                  onClick={() => navigate(`/staff/${member.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="py-4 px-4">
                    <span className="text-sm font-semibold text-gray-400">{idx + 1}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          {member.badges.includes('topPerformer') && (
                            <Star size={14} className="text-amber-500 fill-amber-500" />
                          )}
                          {member.badges.includes('struggling') && (
                            <AlertTriangle size={14} className="text-amber-500" />
                          )}
                          {member.badges.includes('new') && (
                            <Badge variant="purple" className="text-[10px] px-1.5 py-0.5">New</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{member.role} · {member.tenure}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{member.thisMonth.covers}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-medium text-gray-900 tabular-nums">${member.thisMonth.revenue.toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">${member.thisMonth.tips.toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm text-gray-600 tabular-nums">{member.tipPercent}%</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {member.thisMonth.efficiency ? (
                      <span className={`text-sm font-medium tabular-nums ${
                        member.thisMonth.efficiency >= 90 ? 'text-green-600' :
                        member.thisMonth.efficiency >= 80 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {member.thisMonth.efficiency}%
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">--</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <TrendIcon trend={member.trend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
