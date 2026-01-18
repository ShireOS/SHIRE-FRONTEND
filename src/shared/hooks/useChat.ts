// useChat Hook
// Manages chat state, streaming, and session storage

import { useState, useEffect, useCallback } from 'react'
import { chatApi } from '../api/chatApi'
import { saveMessages, loadMessages, clearMessages as clearStoredMessages } from '../utils/chatStorage'
import { API_CONFIG } from '../api/config'
import type { ChatMessage, StreamChunk, ApiError } from '../types/api'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  // Load messages from session storage on mount
  useEffect(() => {
    const loadedMessages = loadMessages()
    if (loadedMessages.length > 0) {
      setMessages(loadedMessages)
    }
  }, [])

  // Save messages to session storage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages)
    }
  }, [messages])

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    setError(null)

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])

    // Prepare assistant message for streaming
    const assistantMessageId = generateMessageId()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString()
    }

    setIsStreaming(true)
    setStreamingMessageId(assistantMessageId)

    // Add empty assistant message that will be filled during streaming
    setMessages(prev => [...prev, assistantMessage])

    try {
      await chatApi.sendMessage(
        API_CONFIG.restaurantId,
        content.trim(),
        messages, // Send conversation history
        (chunk: StreamChunk) => {
          if (chunk.type === 'start') {
            // Stream started
            if (import.meta.env.DEV) {
              console.log('[Chat] Stream started')
            }
          } else if (chunk.type === 'content' && chunk.content) {
            // Update message content with new chunk
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + chunk.content }
                  : msg
              )
            )
          } else if (chunk.type === 'done') {
            // Stream completed
            setIsStreaming(false)
            setStreamingMessageId(null)
            if (import.meta.env.DEV) {
              console.log('[Chat] Stream completed')
            }
          } else if (chunk.type === 'error') {
            // Error in stream
            setError({
              status: 500,
              message: chunk.message || 'An error occurred during streaming'
            })
            setIsStreaming(false)
            setStreamingMessageId(null)
            // Remove the empty assistant message
            setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
          }
        },
        (apiError: ApiError) => {
          // Handle API errors
          setError(apiError)
          setIsStreaming(false)
          setStreamingMessageId(null)
          // Remove the empty assistant message
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
        }
      )
    } catch (err) {
      console.error('[Chat] Unexpected error:', err)
      setError({
        status: 0,
        message: err instanceof Error ? err.message : 'An unexpected error occurred'
      })
      setIsStreaming(false)
      setStreamingMessageId(null)
      // Remove the empty assistant message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
    }
  }, [messages, isStreaming])

  const clearHistory = useCallback(() => {
    setMessages([])
    clearStoredMessages()
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    streamingMessageId,
    error,
    sendMessage,
    clearHistory
  }
}
