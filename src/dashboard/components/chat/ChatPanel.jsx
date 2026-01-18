import { useState, useRef, useEffect } from 'react'
import { X, Send, Sparkles, Loader2, User, Bot } from 'lucide-react'
import { chatApi } from '../../../shared/api/chatApi'
import { useRestaurants } from '../../../shared/hooks/useMenuAnalytics'

/**
 * Slide-out chat panel for AI assistant
 */
export function ChatPanel({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your restaurant AI assistant. Ask me about sales trends, staff performance, menu optimization, or any other insights about your restaurant.',
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [restaurantId, setRestaurantId] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Fetch restaurants to get real UUID
  const { data: restaurants } = useRestaurants()

  // Auto-select Mimosas restaurant
  useEffect(() => {
    if (restaurants && !restaurantId) {
      const mimosas = restaurants.find((r) => r.name === 'Mimosas')
      if (mimosas) {
        setRestaurantId(mimosas.id)
      } else if (restaurants.length > 0) {
        setRestaurantId(restaurants[0].id)
      }
    }
  }, [restaurants, restaurantId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isStreaming || !restaurantId) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)
    setStreamingContent('')

    // Build history from previous messages (excluding the initial greeting)
    const history = messages.slice(1).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    await chatApi.sendMessageStream(
      userMessage,
      history,
      {
        onToken: (token) => {
          setStreamingContent((prev) => prev + token)
        },
        onComplete: (fullResponse) => {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: fullResponse },
          ])
          setStreamingContent('')
          setIsStreaming(false)
        },
        onError: (error) => {
          console.error('Chat error:', error)
          // Extract readable error message
          let errorMsg = 'Unknown error'
          if (error instanceof Error) {
            errorMsg = error.message
          } else if (typeof error === 'string') {
            errorMsg = error
          } else if (error && typeof error === 'object') {
            errorMsg = error.message || error.detail || JSON.stringify(error)
          }

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
            },
          ])
          setStreamingContent('')
          setIsStreaming(false)
        },
      },
      restaurantId
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">AI Assistant</h2>
              <p className="text-blue-100 text-xs">Ask anything about your restaurant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <ChatMessage
              message={{ role: 'assistant', content: streamingContent }}
              isStreaming
            />
          )}

          {/* Loading indicator */}
          {isStreaming && !streamingContent && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 size={16} className="animate-spin text-gray-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about sales, staff, menu..."
              className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-xl flex items-center justify-center text-white transition-colors"
            >
              {isStreaming ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </>
  )
}

/**
 * Individual chat message bubble
 */
function ChatMessage({ message, isStreaming = false }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-gray-200' : 'bg-blue-100'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-gray-600" />
        ) : (
          <Bot size={16} className="text-blue-600" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  )
}
