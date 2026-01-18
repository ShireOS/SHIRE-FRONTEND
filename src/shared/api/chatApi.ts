// Chat API with Server-Sent Events (SSE) streaming support

import { ENDPOINTS } from './endpoints'
import { API_CONFIG, getApiUrl } from './config'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatStreamCallbacks {
  onToken: (token: string) => void
  onComplete: (fullResponse: string) => void
  onError: (error: Error) => void
}

export const chatApi = {
  /**
   * Send a message and stream the response via SSE
   */
  sendMessageStream: async (
    message: string,
    history: ChatMessage[],
    callbacks: ChatStreamCallbacks,
    restaurantId?: string
  ): Promise<void> => {
    const id = restaurantId || API_CONFIG.restaurantId
    const url = getApiUrl(ENDPOINTS.chatMessage(id))

    if (import.meta.env.DEV) {
      console.log('[chatApi] Sending message to:', url)
      console.log('[chatApi] Message:', message)
      console.log('[chatApi] History length:', history.length)
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message,
          history,
        }),
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch {
          // Response wasn't JSON
        }

        // Provide user-friendly messages for common errors
        if (response.status === 500 && errorMessage.includes('API key')) {
          errorMessage = 'The AI service is not configured. Please set up the OPENROUTER_API_KEY in the backend.'
        } else if (response.status === 404) {
          errorMessage = 'Restaurant not found. Please check the configuration.'
        }

        throw new Error(errorMessage)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let fullResponse = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events from buffer
        // Backend format: "event: message\ndata: {...}\n\n"
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const event of events) {
          const lines = event.split('\n')
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              eventData = line.slice(6) // Remove 'data: ' prefix
            }
          }

          if (!eventData) continue

          try {
            console.log('[chatApi] Parsing SSE data:', eventData)
            const parsed = JSON.parse(eventData)
            console.log('[chatApi] Parsed:', parsed)

            // Handle backend's event types
            if (parsed.type === 'content' && parsed.content) {
              fullResponse += parsed.content
              callbacks.onToken(parsed.content)
            } else if (parsed.type === 'done') {
              callbacks.onComplete(fullResponse)
              return
            } else if (parsed.type === 'error') {
              console.error('[chatApi] Server returned error:', parsed)
              throw new Error(parsed.message || 'Unknown error from server')
            }
            // 'start' type is ignored - just initialization
          } catch (parseError) {
            // If this is our own thrown error (from type === 'error'), re-throw it
            if (parseError instanceof Error && parseError.message !== 'Unexpected token') {
              throw parseError
            }
            // Log parse errors for debugging
            console.warn('[chatApi] Failed to parse SSE data:', eventData, parseError)
          }
        }
      }

      // If we reach here without a 'done' event, complete anyway
      callbacks.onComplete(fullResponse)
    } catch (error) {
      console.error('[chatApi] Error:', error)
      console.error('[chatApi] Error type:', typeof error)
      console.error('[chatApi] Error constructor:', error?.constructor?.name)
      if (error && typeof error === 'object') {
        console.error('[chatApi] Error keys:', Object.keys(error))
        console.error('[chatApi] Error stringified:', JSON.stringify(error, null, 2))
      }
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    }
  },
}
