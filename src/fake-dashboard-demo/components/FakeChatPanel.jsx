import { useState, useRef, useEffect } from 'react'
import { X, Send, Sparkles, Loader2, User, Bot } from 'lucide-react'
import { chatResponses, defaultResponse, suggestedPrompts } from '../data/mimosasChatResponses'

export default function FakeChatPanel({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Welcome to Mimosas Southern Kitchen & Bar. I'm your restaurant Concierge. Ask me about today's revenue, menu performance, staff metrics, reviews, or any other insights about your restaurant.",
    },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const findResponse = (userMessage) => {
    const lower = userMessage.toLowerCase()
    const match = chatResponses.find((r) =>
      r.patterns.some((p) => lower.includes(p))
    )
    return match ? match.response : defaultResponse
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)
    setStreamingContent('')

    const response = findResponse(userMessage)

    // Simulate streaming with character-by-character output
    let idx = 0
    const interval = setInterval(() => {
      if (idx >= response.length) {
        clearInterval(interval)
        setMessages((prev) => [...prev, { role: 'assistant', content: response }])
        setStreamingContent('')
        setIsStreaming(false)
        return
      }
      // Add 3-5 characters at a time for realistic speed
      const chunk = response.slice(idx, idx + 3 + Math.floor(Math.random() * 3))
      idx += chunk.length
      setStreamingContent((prev) => prev + chunk)
    }, 15)
  }

  const handleSuggestion = (prompt) => {
    setInput(prompt)
    // Auto-submit
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} }
      setInput('')
      setMessages((prev) => [...prev, { role: 'user', content: prompt }])
      setIsStreaming(true)
      setStreamingContent('')

      const response = findResponse(prompt)
      let idx = 0
      const interval = setInterval(() => {
        if (idx >= response.length) {
          clearInterval(interval)
          setMessages((prev) => [...prev, { role: 'assistant', content: response }])
          setStreamingContent('')
          setIsStreaming(false)
          return
        }
        const chunk = response.slice(idx, idx + 3 + Math.floor(Math.random() * 3))
        idx += chunk.length
        setStreamingContent((prev) => prev + chunk)
      }, 15)
    }, 50)
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-dash-base/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="dashboard-chat-rail fixed right-0 top-0 h-full w-full max-w-md shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 glass-panel soft-divider-bottom">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center">
              <Sparkles size={20} className="text-dash-gold" />
            </div>
            <div>
              <h2 className="text-dash-cream font-semibold">
                <span className="font-dash-display italic text-dash-gold">Concierge</span>
              </h2>
              <p className="text-dash-tertiary text-xs italic">Watching your floor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-tertiary hover:text-dash-cream hover:bg-dash-cream/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dash-base">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}

          {isStreaming && streamingContent && (
            <ChatMessage
              message={{ role: 'assistant', content: streamingContent }}
              isStreaming
            />
          )}

          {isStreaming && !streamingContent && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-dash-gold/20 border border-dash-gold/30 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-dash-gold" />
              </div>
              <div className="glass-card rounded-lg rounded-tl-sm px-4 py-3">
                <Loader2 size={16} className="animate-spin text-dash-tertiary" />
              </div>
            </div>
          )}

          {/* Suggested prompts - only show at start */}
          {messages.length === 1 && !isStreaming && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-dash-tertiary">Try asking:</p>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestion(prompt)}
                  className="block w-full text-left px-3 py-2 rounded-lg bg-dash-cream/5 hover:bg-dash-cream/10 text-sm text-dash-secondary hover:text-dash-cream border border-dash-border transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 soft-divider-top bg-dash-surface">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about Mimosas..."
              className="flex-1 px-4 py-3 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream text-sm focus:outline-none focus:ring-1 focus:ring-dash-gold/50 focus:border-dash-gold/50 transition-all placeholder:text-dash-tertiary"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="w-11 h-11 bg-dash-gold hover:bg-dash-gold/90 disabled:bg-dash-cream/10 rounded-lg flex items-center justify-center text-dash-base transition-colors"
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

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </>
  )
}

function ChatMessage({ message, isStreaming = false }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-dash-gold/20 border border-dash-gold/30'
            : 'bg-dash-gold/20 border border-dash-gold/30'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-dash-cream" />
        ) : (
          <Bot size={16} className="text-dash-gold" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-dash-gold text-dash-base rounded-tr-sm'
            : 'glass-card text-dash-cream rounded-tl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-dash-gold ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  )
}
