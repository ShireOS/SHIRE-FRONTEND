import type { TableStateEvent } from '../../host/types'

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

export class DemoWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private url: string = ''
  private onTableStateCallback: ((event: TableStateEvent) => void) | null = null
  private onErrorCallback: (() => void) | null = null
  private status: ConnectionStatus = 'disconnected'

  connect(
    url: string,
    onTableState: (event: TableStateEvent) => void,
    onError: () => void
  ): void {
    this.url = url
    this.onTableStateCallback = onTableState
    this.onErrorCallback = onError
    this.status = 'connecting'

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected to demo stream')
        this.status = 'connected'
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Ignore keepalive pings from backend
          if (data.type === 'ping') {
            return
          }

          if (data.type === 'table.state') {
            console.log('[WebSocket] Table state update:', data)
            this.onTableStateCallback?.(data as TableStateEvent)
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        this.status = 'disconnected'
      }

      this.ws.onclose = () => {
        console.log('[WebSocket] Connection closed')
        this.status = 'disconnected'
        this.attemptReconnect()
      }
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error)
      this.status = 'disconnected'
      this.onErrorCallback?.()
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached')
      this.onErrorCallback?.()
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    )

    this.reconnectTimeout = setTimeout(() => {
      if (this.url && this.onTableStateCallback && this.onErrorCallback) {
        this.connect(this.url, this.onTableStateCallback, this.onErrorCallback)
      }
    }, delay)
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.status = 'disconnected'
    this.reconnectAttempts = 0
    console.log('[WebSocket] Disconnected')
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status
  }
}
