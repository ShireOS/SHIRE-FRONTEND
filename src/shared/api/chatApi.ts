// Chat API
// Handles streaming chat messages with the AI assistant

import { apiClient } from './client'
import { ENDPOINTS } from './endpoints'
import type { ChatMessage, ChatRequest, StreamChunk, ApiError } from '../types/api'

/**
 * Send a message to the AI assistant and receive a streaming response
 *
 * @param restaurantId - The restaurant ID to send the message for
 * @param message - The user's message
 * @param history - Optional conversation history
 * @param onChunk - Callback function called for each chunk of the response
 * @param onError - Optional callback for handling errors
 * @returns Promise that resolves when streaming is complete
 */
export async function sendChatMessage(
  restaurantId: string,
  message: string,
  history: ChatMessage[],
  onChunk: (chunk: StreamChunk) => void,
  onError?: (error: ApiError) => void
): Promise<void> {
  const endpoint = ENDPOINTS.chatMessage(restaurantId)

  const requestBody: ChatRequest = {
    message,
    history: history.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }

  await apiClient.streamPost(
    endpoint,
    requestBody,
    (data: unknown) => {
      // Type guard to ensure data is a StreamChunk
      const chunk = data as StreamChunk
      onChunk(chunk)
    },
    onError
  )
}

export const chatApi = {
  sendMessage: sendChatMessage
}
