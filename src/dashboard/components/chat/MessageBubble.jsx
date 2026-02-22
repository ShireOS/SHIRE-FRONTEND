// Message Bubble Component
// Displays individual chat messages with different styles for user vs assistant

import { User, Sparkles } from 'lucide-react'

export function MessageBubble({ message, isStreaming = false }) {
  const isUser = message.role === 'user'
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (isUser) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 justify-end">
        <div className="flex flex-col items-end max-w-[80%]">
          <div className="bg-dash-gold text-dash-base rounded-2xl rounded-tr-md px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-xs text-dash-tertiary mt-1 px-1">{timestamp}</span>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-dash-gold/20 border border-dash-gold/30 flex items-center justify-center">
          <User size={16} className="text-dash-cream" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-dash-gold/20 border border-dash-gold/30 flex items-center justify-center">
        <Sparkles size={16} className="text-dash-gold" />
      </div>
      <div className="flex flex-col max-w-[80%]">
        <div className="glass-card text-dash-cream rounded-2xl rounded-tl-md px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
            {isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-dash-gold animate-pulse" />}
          </p>
        </div>
        <span className="text-xs text-dash-tertiary mt-1 px-1">{timestamp}</span>
      </div>
    </div>
  )
}
