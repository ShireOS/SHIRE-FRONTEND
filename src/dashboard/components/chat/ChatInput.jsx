// Chat Input Component
// Textarea with send button for user messages

import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

export function ChatInput({ onSend, disabled = false }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])

  return (
    <form onSubmit={handleSubmit} className="flex-shrink-0 p-4 bg-dash-surface soft-divider-top">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about your restaurant..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl bg-dash-cream/5 border border-dash-border px-4 py-3 text-sm text-dash-cream focus:outline-none focus:ring-1 focus:ring-dash-gold/50 focus:border-dash-gold/50 disabled:bg-dash-surface disabled:cursor-not-allowed max-h-32 overflow-y-auto placeholder:text-dash-tertiary"
          style={{ minHeight: '44px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="flex-shrink-0 w-11 h-11 bg-dash-gold hover:bg-dash-gold/90 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-dash-cream/10"
        >
          <Send size={18} className="text-dash-base" />
        </button>
      </div>
      <p className="text-xs text-dash-tertiary mt-2 px-1">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  )
}
