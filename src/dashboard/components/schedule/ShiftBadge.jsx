import { Sparkles, AlertTriangle } from 'lucide-react'

/**
 * Shift badge with AI reasoning tooltip
 * Displays shift time with hover tooltip showing why AI assigned this shift
 */
export function ShiftBadge({ shift, dayType, onClick }) {
  const hasReasoning = shift.reasoning && shift.reasoning.reasons.length > 0
  const hasViolations = shift.reasoning && shift.reasoning.constraint_violations.length > 0

  // Badge styling based on day type and source
  const getBadgeStyle = () => {
    let baseStyle = 'inline-block px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all relative group'

    // AI-generated shifts get purple ring
    if (shift.source === 'engine') {
      baseStyle += ' ring-2 ring-purple-200'
    }

    // Color based on day type
    if (dayType === 'busy') {
      return `${baseStyle} bg-orange-50 text-orange-700 hover:bg-orange-100`
    }
    return `${baseStyle} bg-blue-50 text-blue-700 hover:bg-blue-100`
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span className={getBadgeStyle()} onClick={onClick}>
        {shift.displayTime}

        {/* AI Reasoning Tooltip (shows on hover) */}
        {hasReasoning && (
          <div className="absolute z-10 invisible group-hover:visible bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />

            {/* Content */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-purple-400" />
                <span className="font-semibold">AI Reasoning</span>
              </div>

              <ul className="space-y-1">
                {shift.reasoning.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-400 flex-shrink-0">✓</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>

              {hasViolations && (
                <>
                  <div className="flex items-center gap-2 mt-3 mb-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="font-semibold text-amber-300">Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {shift.reasoning.constraint_violations.map((violation, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 flex-shrink-0">⚠</span>
                        <span className="text-amber-200">{violation}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-3 pt-2 border-t border-gray-700 text-gray-400">
                Confidence: {Math.round(shift.reasoning.confidence_score * 100)}%
              </div>
            </div>
          </div>
        )}
      </span>

      {/* AI Indicator */}
      {shift.source === 'engine' && (
        <span className="text-[10px] text-purple-600 font-medium flex items-center gap-1">
          <Sparkles size={10} />
          AI
        </span>
      )}
    </div>
  )
}
