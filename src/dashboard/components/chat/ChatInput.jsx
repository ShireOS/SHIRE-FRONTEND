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
    <form onSubmit={handleSubmit} className="flex-shrink-0 p-4 bg-white border-t border-gray-100">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about your restaurant..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed max-h-32 overflow-y-auto"
          style={{ minHeight: '44px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
        >
          <Send size={18} className="text-white" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2 px-1">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  )
}
