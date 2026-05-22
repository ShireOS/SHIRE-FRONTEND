// Chat Interface Component
// Main container for the AI chat feature

import { ChatHeader } from './ChatHeader'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { useChat } from '../../../shared/hooks/useChat'
import { useAuth } from '../../../auth'

export function ChatInterface({ onMinimize }) {
  const { restaurant } = useAuth()
  const restaurantId = restaurant.currentRestaurant?.id
  const {
    messages,
    isStreaming,
    streamingMessageId,
    error,
    sendMessage,
    clearHistory
  } = useChat(restaurantId)

  const handleSend = (message) => {
    sendMessage(message)
  }

  const handlePromptClick = (prompt) => {
    sendMessage(prompt)
  }

  const handleClear = () => {
    if (confirm('Clear all messages?')) {
      clearHistory()
    }
  }

  return (
    <div className="h-full flex flex-col bg-dash-surface">
      <ChatHeader
        onMinimize={onMinimize}
        onClear={handleClear}
        hasMessages={messages.length > 0}
      />

      {error && (
        <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {error.message}
          </p>
        </div>
      )}

      <ChatMessages
        messages={messages}
        isTyping={isStreaming && !streamingMessageId}
        streamingMessageId={streamingMessageId}
        onPromptClick={handlePromptClick}
      />

      <ChatInput
        onSend={handleSend}
        disabled={isStreaming || !restaurantId}
      />
    </div>
  )
}
