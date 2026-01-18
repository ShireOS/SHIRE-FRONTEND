// Chat Messages Component
// Scrollable container for chat messages

import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { SuggestedPrompts } from './SuggestedPrompts'

export function ChatMessages({ messages, isTyping, streamingMessageId, onPromptClick }) {
  const messagesEndRef = useRef(null)
  const containerRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping])

  // Show suggested prompts if no messages
  if (messages.length === 0) {
    return (
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <SuggestedPrompts onPromptClick={onPromptClick} />
        <div ref={messagesEndRef} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="py-4 space-y-2">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={message.id === streamingMessageId}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
