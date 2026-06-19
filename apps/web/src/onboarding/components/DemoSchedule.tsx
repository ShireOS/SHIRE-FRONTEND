import { motion } from 'framer-motion'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface ShiftBlock {
  day: number
  startRow: number
  span: number
  name: string
  role: string
  isOptimized?: boolean
}

const SHIFTS: ShiftBlock[] = [
  { day: 0, startRow: 0, span: 2, name: 'Alex M.', role: 'Server' },
  { day: 0, startRow: 2, span: 2, name: 'Sarah K.', role: 'Server' },
  { day: 1, startRow: 0, span: 3, name: 'James L.', role: 'Host' },
  { day: 1, startRow: 3, span: 1, name: 'Maria D.', role: 'Server' },
  { day: 2, startRow: 0, span: 2, name: 'Sarah K.', role: 'Server' },
  { day: 2, startRow: 2, span: 2, name: 'Alex M.', role: 'Server', isOptimized: true },
  { day: 3, startRow: 0, span: 2, name: 'James L.', role: 'Host' },
  { day: 3, startRow: 2, span: 2, name: 'Maria D.', role: 'Server' },
  { day: 4, startRow: 0, span: 3, name: 'Alex M.', role: 'Server' },
  { day: 4, startRow: 3, span: 1, name: 'Sarah K.', role: 'Server' },
  { day: 5, startRow: 0, span: 2, name: 'Maria D.', role: 'Server' },
  { day: 5, startRow: 2, span: 2, name: 'James L.', role: 'Host' },
  { day: 6, startRow: 0, span: 2, name: 'Sarah K.', role: 'Server' },
  { day: 6, startRow: 2, span: 1, name: 'Alex M.', role: 'Server' },
]

const COLORS = [
  'rgba(99, 102, 241, 0.3)',   // indigo
  'rgba(168, 85, 247, 0.3)',   // purple
  'rgba(59, 130, 246, 0.3)',   // blue
  'rgba(236, 72, 153, 0.3)',   // pink
]

const NAME_COLORS: Record<string, string> = {
  'Alex M.': COLORS[0],
  'Sarah K.': COLORS[1],
  'James L.': COLORS[2],
  'Maria D.': COLORS[3],
}

export function DemoSchedule() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
          <span className="label-mono text-[rgb(var(--text-secondary))]">0 CONFLICTS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[rgb(var(--gold))]" />
          <span className="label-mono text-[rgb(var(--text-secondary))]">FAIR DISTRIBUTION: 98%</span>
        </div>
      </div>

      {/* Schedule grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(day => (
              <div key={day} className="text-center">
                <span className="label-mono text-[rgb(var(--text-tertiary))]">{day}</span>
              </div>
            ))}
          </div>

          {/* Shift grid */}
          <div className="grid grid-cols-7 gap-1" style={{ gridAutoRows: '40px' }}>
            {DAYS.map((_, dayIndex) => (
              <div key={dayIndex} className="relative" style={{ gridRow: 'span 4' }}>
                {/* Background slots */}
                {[0, 1, 2, 3].map(row => (
                  <div
                    key={row}
                    className="absolute w-full border border-[rgba(255,255,255,0.04)] rounded-md"
                    style={{ top: `${row * 25}%`, height: '25%' }}
                  />
                ))}

                {/* Shift blocks */}
                {SHIFTS.filter(s => s.day === dayIndex).map((shift, i) => (
                  <motion.div
                    key={`${shift.day}-${shift.startRow}`}
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ delay: (shift.day * 2 + i) * 0.06, duration: 0.3 }}
                    className={`absolute w-full rounded-md px-1.5 py-1 overflow-hidden ${
                      shift.isOptimized
                        ? 'border border-[rgb(var(--gold))] shadow-[0_0_8px_rgba(201,169,98,0.2)]'
                        : 'border border-transparent'
                    }`}
                    style={{
                      top: `${shift.startRow * 25}%`,
                      height: `${shift.span * 25}%`,
                      backgroundColor: shift.isOptimized
                        ? 'rgba(201, 169, 98, 0.15)'
                        : NAME_COLORS[shift.name] || COLORS[0],
                    }}
                  >
                    <p className="text-[10px] font-medium text-[rgb(var(--text-primary))] truncate">{shift.name}</p>
                    {shift.span > 1 && (
                      <p className="text-[9px] text-[rgb(var(--text-tertiary))] truncate">{shift.role}</p>
                    )}
                    {shift.isOptimized && (
                      <span className="text-[8px] text-[rgb(var(--gold))] font-medium">AI</span>
                    )}
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm border border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.15)]" />
          <span className="text-[rgb(var(--text-tertiary))] text-xs">AI Optimized</span>
        </div>
      </div>
    </div>
  )
}
