// Chat Storage Utility
// Manages session storage for chat conversation history

import type { ChatMessage } from '../types/api'

const STORAGE_KEY = 'shire-chat-history'

/**
 * Save chat messages to session storage
 * Messages persist during the browser session but are cleared on page refresh
 */
export function saveMessages(messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch (error) {
    console.error('[ChatStorage] Failed to save messages:', error)
  }
}

/**
 * Load chat messages from session storage
 * Returns an empty array if no messages are stored or if parsing fails
 */
export function loadMessages(): ChatMessage[] {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY)
    if (!data) {
      return []
    }
    return JSON.parse(data) as ChatMessage[]
  } catch (error) {
    console.error('[ChatStorage] Failed to load messages:', error)
    return []
  }
}

/**
 * Clear all chat messages from session storage
 */
export function clearMessages(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[ChatStorage] Failed to clear messages:', error)
  }
}
