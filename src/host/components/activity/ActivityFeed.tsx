import { motion, AnimatePresence } from 'framer-motion'
import { Users, AlertTriangle, Utensils, Clock, Calendar, User } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { activityItemVariants } from '../../lib/animations'
import { cn } from '../../lib/cn'
import type { ActivityItem, ActivityType } from '../../types'

const iconMap: Record<ActivityType, typeof Users> = {
  seated: Users,
  cleared: Utensils,
  reservation_arrived: Calendar,
  wait_added: Clock,
  table_status_change: Utensils,
  server_assigned: User,
  cv_alert: AlertTriangle,
}

const colorMap: Record<ActivityType, string> = {
  seated: 'text-accent-green bg-accent-green/15',
  cleared: 'text-accent-blue bg-accent-blue/15',
  reservation_arrived: 'text-accent-purple bg-accent-purple/15',
  wait_added: 'text-secondary bg-white/[0.05]',
  table_status_change: 'text-accent-orange bg-accent-orange/15',
  server_assigned: 'text-accent-blue bg-accent-blue/15',
  cv_alert: 'text-accent-yellow bg-accent-yellow/15',
}

export function ActivityFeed() {
  const activity = useRestaurantStore((s) => s.activity)

  const formatTime = (date: Date) => {
    const mins = Math.round((Date.now() - date.getTime()) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="label-mono">
          Activity
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {activity.map((item) => (
            <ActivityItemCard key={item.id} item={item} formatTime={formatTime} />
          ))}
        </AnimatePresence>

        {activity.length === 0 && (
          <div className="p-4 text-center text-tertiary text-sm">
            No recent activity
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityItemCard({
  item,
  formatTime,
}: {
  item: ActivityItem
  formatTime: (date: Date) => string
}) {
  const Icon = iconMap[item.type]
  const colorClass = colorMap[item.type]

  return (
    <motion.div
      variants={activityItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={cn(
        'px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors',
        item.priority === 'high' && !item.read && 'bg-accent-red/[0.03]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary leading-tight">{item.message}</p>
          <p className="font-data text-[10px] text-tertiary mt-1">{formatTime(item.timestamp)}</p>
        </div>
        {item.priority === 'high' && !item.read && (
          <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse shrink-0 mt-1" />
        )}
      </div>
    </motion.div>
  )
}
