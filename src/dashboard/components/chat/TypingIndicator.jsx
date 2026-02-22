// Typing Indicator Component
// Shows animated dots while AI is thinking

import { Sparkles } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-dash-gold/20 border border-dash-gold/30 flex items-center justify-center">
        <Sparkles size={16} className="text-dash-gold" />
      </div>
      <div className="flex items-center gap-1.5 glass-card rounded-2xl px-4 py-3">
        <div className="w-2 h-2 bg-dash-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-dash-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-dash-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
