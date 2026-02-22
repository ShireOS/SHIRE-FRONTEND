// Chat Header Component
// Header with title and minimize button

import { Sparkles, ChevronRight, Trash2 } from 'lucide-react'

export function ChatHeader({ onMinimize, onClear, hasMessages }) {
  return (
    <div className="flex-shrink-0 p-4 glass-panel soft-divider-bottom">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center">
            <Sparkles size={20} className="text-dash-gold" />
          </div>
          <div>
            <h2 className="text-dash-cream font-semibold text-base">AI Assistant</h2>
            <p className="text-dash-tertiary text-xs italic">Ask about your restaurant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={onClear}
              className="p-2 hover:bg-dash-cream/10 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={18} className="text-dash-cream" />
            </button>
          )}
          <button
            onClick={onMinimize}
            className="p-2 hover:bg-dash-cream/10 rounded-lg transition-colors"
            title="Minimize chat"
          >
            <ChevronRight size={20} className="text-dash-cream" />
          </button>
        </div>
      </div>
    </div>
  )
}
