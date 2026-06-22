import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface DemoAnalyticsProps {
  restaurantType: string | null
}

function useCountUp(end: number, duration: number = 1500) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [end, duration])

  return count
}

const BAR_DATA = [
  { label: 'Mon', value: 65 },
  { label: 'Tue', value: 78 },
  { label: 'Wed', value: 52 },
  { label: 'Thu', value: 89 },
  { label: 'Fri', value: 95 },
  { label: 'Sat', value: 100 },
  { label: 'Sun', value: 72 },
]

export function DemoAnalytics({ restaurantType }: DemoAnalyticsProps) {
  const isFine = restaurantType === 'fine_dining'
  const avgRevenue = isFine ? 12400 : 6800
  const avgCovers = isFine ? 85 : 145
  const avgTurn = isFine ? 92 : 28
  const revenue = useCountUp(avgRevenue)
  const covers = useCountUp(avgCovers)
  const turnTime = useCountUp(avgTurn)
  const rating = useCountUp(48) // will divide by 10

  const stats = [
    { label: 'DAILY REVENUE', value: `$${revenue.toLocaleString()}`, sublabel: 'avg last 30d' },
    { label: 'COVERS TODAY', value: covers.toString(), sublabel: `of ${avgCovers + 20} expected` },
    { label: isFine ? 'TURN TIME' : 'AVG TURN', value: `${turnTime}m`, sublabel: isFine ? 'avg per table' : 'table average' },
    { label: 'GUEST RATING', value: (rating / 10).toFixed(1), sublabel: 'last 90 days' },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]"
          >
            <p className="label-mono text-[rgb(var(--gold))] mb-1">{stat.label}</p>
            <p className="text-2xl font-medium text-[rgb(var(--text-primary))] tabular-nums">{stat.value}</p>
            <p className="text-xs text-[rgb(var(--text-tertiary))] mt-0.5">{stat.sublabel}</p>
          </motion.div>
        ))}
      </div>

      {/* Bar chart */}
      <div>
        <p className="label-mono text-[rgb(var(--text-tertiary))] mb-4">WEEKLY PERFORMANCE</p>
        <div className="flex items-end gap-2 h-32">
          {BAR_DATA.map((bar, i) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                className="w-full rounded-t-md"
                style={{
                  background: bar.value === 100
                    ? 'linear-gradient(to top, rgb(var(--gold)), rgba(201, 169, 98, 0.6))'
                    : 'rgba(255, 255, 255, 0.1)',
                }}
                initial={{ height: 0 }}
                animate={{ height: `${bar.value}%` }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.4, ease: 'easeOut' }}
              />
              <span className="text-[10px] text-[rgb(var(--text-tertiary))]">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue trend line (simplified SVG) */}
      <div className="pt-2">
        <p className="label-mono text-[rgb(var(--text-tertiary))] mb-3">REVENUE TREND</p>
        <svg viewBox="0 0 400 80" className="w-full h-20">
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(201,169,98,0.3)" />
              <stop offset="100%" stopColor="rgba(201,169,98,0)" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <motion.path
            d="M0,60 L57,50 L114,55 L171,35 L228,40 L285,20 L342,25 L400,10 L400,80 L0,80 Z"
            fill="url(#lineGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          />
          {/* Line */}
          <motion.path
            d="M0,60 L57,50 L114,55 L171,35 L228,40 L285,20 L342,25 L400,10"
            fill="none"
            stroke="rgb(201,169,98)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.8, duration: 1.2, ease: 'easeInOut' }}
          />
        </svg>
      </div>
    </div>
  )
}
