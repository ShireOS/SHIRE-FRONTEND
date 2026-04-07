import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Activity, Users, TrendingUp, RotateCcw, X } from 'lucide-react'
import { useEffect } from 'react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { ActivityFeed } from '../activity/ActivityFeed'
import { cn } from '../../lib/cn'
import type { Server } from '../../types'

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || 'default'
const IS_FAKE_HOST = window.location.pathname.startsWith('/fake-host-ui')

export function RightPanel() {
  const collapsed = useRestaurantStore((s) => s.rightPanelCollapsed)
  const togglePanel = useRestaurantStore((s) => s.toggleRightPanel)
  const activity = useRestaurantStore((s) => s.activity)
  const servers = useRestaurantStore((s) => s.servers)
  const tables = useRestaurantStore((s) => s.tables)
  const selectedServerId = useRestaurantStore((s) => s.selectedServerId)
  const setSelectedServer = useRestaurantStore((s) => s.setSelectedServer)
  const demoActive = useRestaurantStore((s) => s.demoActive)
  const fetchDemoSummary = useRestaurantStore((s) => s.fetchDemoSummary)

  // Try to fetch demo summary on mount (in case backend has waiter data)
  useEffect(() => {
    if (IS_FAKE_HOST) return
    fetchDemoSummary(RESTAURANT_ID)
  }, [fetchDemoSummary])

  // Poll demo summary every 10 seconds when demo is active
  useEffect(() => {
    if (IS_FAKE_HOST || !demoActive) return

    // Fetch immediately when demo starts
    fetchDemoSummary(RESTAURANT_ID)

    // Then poll every 10 seconds
    const interval = setInterval(() => {
      fetchDemoSummary(RESTAURANT_ID)
    }, 10000)

    return () => clearInterval(interval)
  }, [demoActive, fetchDemoSummary])

  const unreadCount = activity.filter((a) => !a.read && a.priority === 'high').length

  // Get active servers sorted by rotation position, with computed table counts
  const activeServers = servers
    .filter((s) => s.status === 'active')
    .map((server) => {
      // Calculate actual table count from tables data
      const serverTables = tables.filter((t) => t.assignedServerId === server.id)
      const occupiedCount = serverTables.filter((t) => t.status === 'occupied').length
      return {
        ...server,
        activeTableCount: occupiedCount, // Override with actual count
      }
    })
    .sort((a, b) => a.rotationPosition - b.rotationPosition)

  // Get selected server for stats
  const selectedServer = selectedServerId
    ? servers.find((s) => s.id === selectedServerId)
    : null

  // Calculate stats - either for selected server or restaurant total
  const getStats = () => {
    if (selectedServer) {
      const serverTables = tables.filter((t) => t.assignedServerId === selectedServer.id)
      const occupiedServerTables = serverTables.filter((t) => t.status === 'occupied')
      return {
        label: selectedServer.name,
        occupancy: serverTables.length > 0 ? Math.round((occupiedServerTables.length / serverTables.length) * 100) : 0,
        efficiency: selectedServer.efficiency,
        tips: selectedServer.totalTips,
        tablesServed: occupiedServerTables.length,
      }
    } else {
      const totalTables = tables.length
      const occupiedTables = tables.filter((t) => t.status === 'occupied').length
      const totalTips = servers.reduce((sum, s) => sum + s.totalTips, 0)
      const avgEfficiency = Math.round(activeServers.reduce((sum, s) => sum + s.efficiency, 0) / (activeServers.length || 1))
      return {
        label: 'Restaurant',
        occupancy: Math.round((occupiedTables / totalTables) * 100),
        efficiency: avgEfficiency,
        tips: totalTips,
        tablesServed: occupiedTables,
      }
    }
  }

  const stats = getStats()

  return (
    <motion.div
      data-right-panel
      initial={false}
      animate={{ width: collapsed ? 48 : 320 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="h-full glass-panel-flat border-l border-white/[0.06] flex flex-col overflow-hidden"
    >
      {/* Collapse Toggle */}
      <button
        onClick={togglePanel}
        className="h-12 flex-shrink-0 flex items-center justify-center border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors"
      >
        <motion.div
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronRight className="w-4 h-4 text-secondary" />
        </motion.div>
      </button>

      <AnimatePresence mode="wait">
        {collapsed ? (
          // Collapsed View: Mini icons
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center pt-4 gap-4"
          >
            <div className="relative">
              <Activity className="w-5 h-5 text-tertiary" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-red text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <Users className="w-5 h-5 text-tertiary" />
            <TrendingUp className="w-5 h-5 text-tertiary" />
          </motion.div>
        ) : (
          // Expanded View - Scrollable
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-y-auto scrollbar-hide"
          >
            {/* Server Rotation Queue */}
            <div className="flex-shrink-0 border-b border-white/[0.06]">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <h3 className="label-mono flex items-center gap-2">
                  <RotateCcw className="w-3 h-3" />
                  Next Up
                </h3>
                <span className="text-[10px] text-tertiary">rotation</span>
              </div>
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                {activeServers.map((server, index) => (
                  <ServerQueueCard
                    key={server.id}
                    server={server}
                    isNext={index === 0}
                    isSelected={selectedServerId === server.id}
                    position={index + 1}
                    onClick={() => setSelectedServer(selectedServerId === server.id ? null : server.id)}
                  />
                ))}
              </div>
            </div>

            {/* Staff Analytics */}
            <div className="flex-shrink-0 border-b border-white/[0.06]">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <h3 className="label-mono flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" />
                  {stats.label} Stats
                </h3>
                {selectedServer && (
                  <button
                    onClick={() => setSelectedServer(null)}
                    className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                  >
                    <X className="w-3 h-3 text-tertiary" />
                  </button>
                )}
              </div>
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                <StatCard
                  label="Occupancy"
                  value={`${stats.occupancy}%`}
                  highlight={selectedServer !== null}
                />
                <StatCard
                  label="Efficiency"
                  value={`${stats.efficiency}%`}
                  trend="up"
                  highlight={selectedServer !== null}
                />
                <StatCard
                  label="Tips"
                  value={`$${stats.tips}`}
                  highlight={selectedServer !== null}
                />
                <StatCard
                  label="Tables Served"
                  value={stats.tablesServed.toString()}
                  highlight={selectedServer !== null}
                />
              </div>
            </div>

            {/* Activity Feed */}
            <div className="flex-1 min-h-[200px]">
              <ActivityFeed />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ServerQueueCard({
  server,
  isNext,
  isSelected,
  onClick,
}: {
  server: Server
  isNext: boolean
  isSelected: boolean
  position: number
  onClick: () => void
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'w-full rounded-lg p-2.5 text-left transition-all cursor-pointer',
        isNext && 'col-span-2',
        isSelected
          ? 'bg-white/[0.12] border-2 border-white/40 ring-2 ring-white/20'
          : isNext
          ? 'bg-accent-primary/[0.15] border border-accent-primary/40'
          : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]'
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: server.color }}
        >
          {server.initials}
        </div>
        <div className="min-w-0">
          <p className={cn(
            'text-[11px] font-medium truncate',
            isSelected ? 'text-white' : isNext ? 'text-accent-primary' : 'text-primary'
          )}>
            {server.name}
          </p>
          <p className="font-data text-[9px] text-tertiary">
            {server.activeTableCount} tables
          </p>
        </div>
      </div>
      {isNext && !isSelected && (
        <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-accent-primary/30 text-accent-primary uppercase">
          Next
        </span>
      )}
      {isSelected && (
        <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-white/20 text-white uppercase">
          Viewing
        </span>
      )}
    </motion.button>
  )
}

function StatCard({
  label,
  value,
  trend,
  highlight,
}: {
  label: string
  value: string
  trend?: 'up' | 'down'
  highlight?: boolean
}) {
  return (
    <div className={cn(
      'rounded-lg p-2.5 transition-all',
      highlight
        ? 'bg-accent-primary/[0.08] border border-accent-primary/30'
        : 'bg-white/[0.03] border border-white/[0.06]'
    )}>
      <p className="text-[9px] uppercase tracking-wider text-tertiary mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        <span className={cn(
          'text-lg font-bold',
          highlight ? 'text-accent-primary' : 'text-primary'
        )}>{value}</span>
        {trend && (
          <TrendingUp
            className={cn(
              'w-3 h-3',
              trend === 'up' ? 'text-accent-green' : 'text-accent-red rotate-180'
            )}
          />
        )}
      </div>
    </div>
  )
}
