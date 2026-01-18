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
import { useStaffWithStatus } from '../../hooks/useStaffData'
import { useRestaurants } from '../../../shared/hooks/useMenuAnalytics'
import { API_CONFIG } from '../../../shared/api/config'

export function StaffTable() {
  const navigate = useNavigate()

  // Auto-select Mimosas restaurant
  const [restaurantId, setRestaurantId] = useState(null)
  const { data: restaurants } = useRestaurants()

  useEffect(() => {
    if (restaurants && restaurants.length > 0) {
      const mimosas = restaurants.find((r) => r.name === 'Mimosas')
      if (mimosas) {
        console.log('[StaffTable] Auto-selecting Mimosas restaurant:', mimosas.id)
        setRestaurantId(mimosas.id)
      } else {
        setRestaurantId(restaurants[0].id)
      }
    }
  }, [restaurants])

  const { staff: allStaff, isLoading, isError, error, refetch } = useStaffWithStatus(restaurantId)

  // Only show servers with actual activity (exclude those with all 0s), limit to 31
  const staff = allStaff
    .filter((s) => s.role.toLowerCase() === 'server')
    .filter((s) => s.thisMonth?.tips > 0 || s.thisMonth?.covers > 0 || s.thisMonth?.revenue > 0)
    .slice(0, 31)

  const [sortField, setSortField] = useState('tips')
  const [sortDir, setSortDir] = useState('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // ENHANCED LOGGING - Track staff data flow through component
  useEffect(() => {
    if (allStaff && allStaff.length > 0) {
      console.group('[StaffTable] Data Flow Analysis')
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
          <Loader2 size={32} className="animate-spin text-dash-gold mx-auto mb-4" />
          <p className="text-dash-cream font-medium">
            {!restaurantId ? 'Loading restaurants...' : 'Loading staff data...'}
          </p>
          <p className="text-sm text-dash-tertiary mt-1">Connecting to backend API</p>
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
            <WifiOff size={40} className="text-dash-danger mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dash-cream mb-2">Cannot Connect to Backend</h3>
            <p className="text-dash-secondary mb-4">{error?.message || 'Unknown error'}</p>

            {/* Debug info */}
            <div className="bg-dash-base rounded-lg p-4 text-left mb-4 max-w-md mx-auto border border-dash-border">
              <p className="label-mono mb-1">DEBUG INFO</p>
              <p className="text-xs font-dash-mono text-dash-secondary">Status: {error?.status || 'N/A'}</p>
              <p className="text-xs font-dash-mono text-dash-secondary">Endpoint: {error?.endpoint || 'N/A'}</p>
              {error?.details && (
                <p className="text-xs font-dash-mono text-dash-secondary mt-1 break-all">
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

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={14} className="text-dash-tertiary" />
    return sortDir === 'asc'
      ? <ChevronUp size={14} className="text-dash-gold" />
      : <ChevronDown size={14} className="text-dash-gold" />
  }

  const TrendIcon = ({ trend }) => {
    if (trend === 'up') return <TrendingUp size={14} className="text-dash-success" />
    if (trend === 'down') return <TrendingDown size={14} className="text-dash-danger" />
    if (trend === 'stable') return <Minus size={14} className="text-dash-tertiary" />
    return <Sparkles size={14} className="text-purple-400" />
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Filters */}
        <div className="p-4 border-b border-dash-border flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dash-tertiary" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-dash-border rounded-lg text-sm text-dash-cream focus:outline-none focus:ring-1 focus:ring-dash-gold/50 focus:border-dash-gold/50 placeholder:text-dash-tertiary"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-dash-border rounded-lg text-sm text-dash-cream focus:outline-none focus:ring-1 focus:ring-dash-gold/50"
          >
            <option value="all">All Roles</option>
            <option value="Server">Servers</option>
            <option value="Busser">Bussers</option>
            <option value="Host">Hosts</option>
          </select>

          {/* Time Filter */}
          <select className="px-4 py-2 bg-white/5 border border-dash-border rounded-lg text-sm text-dash-cream focus:outline-none focus:ring-1 focus:ring-dash-gold/50">
            <option>This Month</option>
            <option>This Week</option>
            <option>Last Month</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dash-border">
                <th className="text-left py-3 px-4 label-mono">
                  RANK
                </th>
                <th
                  className="text-left py-3 px-4 label-mono cursor-pointer hover:text-dash-cream"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    NAME <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 label-mono cursor-pointer hover:text-dash-cream"
                  onClick={() => handleSort('covers')}
                >
                  <div className="flex items-center justify-end gap-1">
                    COVERS <SortIcon field="covers" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 label-mono">
                  REVENUE
                </th>
                <th
                  className="text-right py-3 px-4 label-mono cursor-pointer hover:text-dash-cream"
                  onClick={() => handleSort('tips')}
                >
                  <div className="flex items-center justify-end gap-1">
                    TIPS <SortIcon field="tips" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 label-mono">
                  TIP %
                </th>
                <th
                  className="text-right py-3 px-4 label-mono cursor-pointer hover:text-dash-cream"
                  onClick={() => handleSort('efficiency')}
                >
                  <div className="flex items-center justify-end gap-1">
                    EFFICIENCY <SortIcon field="efficiency" />
                  </div>
                </th>
                <th className="text-center py-3 px-4 label-mono">
                  TREND
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {filteredStaff.map((member, idx) => (
                <tr
                  key={member.id}
                  onClick={() => navigate(`/staff/${member.id}`)}
                  className="hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="py-4 px-4">
                    <span className={`text-sm font-semibold ${idx === 0 ? 'text-dash-gold' : 'text-dash-tertiary'}`}>{idx + 1}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                        idx === 0 ? 'bg-dash-gold/20 text-dash-gold border border-dash-gold/30' : 'bg-white/10 text-dash-cream border border-dash-border'
                      }`}>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-dash-cream">{member.name}</p>
                          {member.badges.includes('topPerformer') && (
                            <Star size={14} className="text-dash-gold fill-dash-gold" />
                          )}
                          {member.badges.includes('struggling') && (
                            <AlertTriangle size={14} className="text-dash-warning" />
                          )}
                          {member.badges.includes('new') && (
                            <Badge variant="purple" className="text-[10px] px-1.5 py-0.5">New</Badge>
                          )}
                        </div>
                        <p className="text-xs text-dash-tertiary">{member.role} · {member.tenure}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-medium text-dash-cream tabular-nums">{member.thisMonth.covers}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-medium text-dash-cream tabular-nums">${member.thisMonth.revenue.toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm font-semibold text-dash-cream tabular-nums">${member.thisMonth.tips.toLocaleString()}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-sm text-dash-secondary tabular-nums">{member.tipPercent}%</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {member.thisMonth.efficiency ? (
                      <span className={`text-sm font-medium tabular-nums ${
                        member.thisMonth.efficiency >= 90 ? 'text-dash-success' :
                        member.thisMonth.efficiency >= 80 ? 'text-dash-warning' :
                        'text-dash-danger'
                      }`}>
                        {member.thisMonth.efficiency}%
                      </span>
                    ) : (
                      <span className="text-sm text-dash-tertiary">--</span>
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
