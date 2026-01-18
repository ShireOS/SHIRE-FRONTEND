// Chat Header Component
// Header with title and minimize button

import { Sparkles, ChevronRight, Trash2 } from 'lucide-react'

export function ChatHeader({ onMinimize, onClear, hasMessages }) {
  return (
    <div className="flex-shrink-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">AI Assistant</h2>
            <p className="text-blue-100 text-xs">Ask about your restaurant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={onClear}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={18} className="text-white" />
            </button>
          )}
          <button
            onClick={onMinimize}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Minimize chat"
          >
            <ChevronRight size={20} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
