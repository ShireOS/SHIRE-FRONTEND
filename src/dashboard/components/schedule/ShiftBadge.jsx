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

    // AI-generated shifts get gold ring
    if (shift.source === 'engine') {
      baseStyle += ' ring-2 ring-dash-gold/30'
    }

    // Color based on day type
    if (dayType === 'busy') {
      return `${baseStyle} bg-dash-warning/20 text-dash-warning hover:bg-dash-warning/30`
    }
    return `${baseStyle} bg-dash-gold/20 text-dash-gold hover:bg-dash-gold/30`
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span className={getBadgeStyle()} onClick={onClick}>
        {shift.displayTime}

        {/* AI Reasoning Tooltip (shows on hover) */}
        {hasReasoning && (
          <div className="absolute z-10 invisible group-hover:visible bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 p-3 glass-card text-dash-cream text-xs rounded-lg shadow-xl">
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-dash-surface rotate-45 border-r border-b border-dash-border" />

            {/* Content */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-dash-gold" />
                <span className="font-semibold">AI Reasoning</span>
              </div>

              <ul className="space-y-1">
                {shift.reasoning.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-dash-success flex-shrink-0">✓</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>

              {hasViolations && (
                <>
                  <div className="flex items-center gap-2 mt-3 mb-2">
                    <AlertTriangle size={14} className="text-dash-warning" />
                    <span className="font-semibold text-dash-warning">Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {shift.reasoning.constraint_violations.map((violation, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-dash-warning flex-shrink-0">⚠</span>
                        <span className="text-dash-secondary">{violation}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-3 pt-2 border-t border-dash-border text-dash-tertiary">
                Confidence: {Math.round(shift.reasoning.confidence_score * 100)}%
              </div>
            </div>
          </div>
        )}
      </span>

      {/* AI Indicator */}
      {shift.source === 'engine' && (
        <span className="text-[10px] text-dash-gold font-medium flex items-center gap-1">
          <Sparkles size={10} />
          AI
        </span>
      )}
    </div>
  )
}
