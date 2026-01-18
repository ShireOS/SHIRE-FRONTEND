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
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl rounded-tr-md px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-xs text-gray-400 mt-1 px-1">{timestamp}</span>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <User size={16} className="text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
        <Sparkles size={16} className="text-white" />
      </div>
      <div className="flex flex-col max-w-[80%]">
        <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-tl-md px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
            {isStreaming && <span className="inline-block w-1 h-4 ml-1 bg-gray-400 animate-pulse" />}
          </p>
        </div>
        <span className="text-xs text-gray-400 mt-1 px-1">{timestamp}</span>
      </div>
    </div>
  )
}
