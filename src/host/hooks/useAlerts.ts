/**
 * useAlerts — connects to the ML backend SSE stream and syncs waiter alerts
 * into the restaurant store. Mount once at the top of the app.
 *
 * On connect the stream replays any currently active alerts, then streams
 * new ones as they fire. Reconnects automatically after errors.
 */
import { useEffect } from 'react'
import { useRestaurantStore } from '../stores/restaurantStore'
import { API_CONFIG } from '../../shared/api/config'

// Strip /api/v1 suffix — alerts live at the root of the ML backend
const ML_BASE_URL = API_CONFIG.baseUrl.replace(/\/api\/v1\/?$/, '')

export function useAlerts(restaurantId: string) {
  const addAlert = useRestaurantStore((s) => s.addAlert)
  const removeAlert = useRestaurantStore((s) => s.removeAlert)

  useEffect(() => {
    if (!restaurantId) return

    const url = `${ML_BASE_URL}/alerts/stream/${restaurantId}`
    let es: EventSource
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource(url)

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'alert') {
            addAlert(data)
          } else if (data.type === 'alert_dismissed') {
            removeAlert(data.alert_id)
          }
          // 'connected' events are ignored — just a handshake
        } catch {
          // malformed frame — ignore
        }
      }

      es.onerror = () => {
        es.close()
        // Back off 3s before reconnect
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [restaurantId, addAlert, removeAlert])
}
