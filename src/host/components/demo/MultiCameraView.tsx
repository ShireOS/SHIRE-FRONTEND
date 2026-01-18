import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Maximize2, Video } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { DemoWebSocket } from '../../../shared/services/websocket'
import { mockTables, mockGuests, mockReservations, mockServers, mockSections, mockActivity, mockRecommendations } from '../../data/mockData'

interface Camera {
  id: string
  name: string
  videoPath: string
  active: boolean
}

interface MultiCameraViewProps {
  isOpen: boolean
  onClose: () => void
  cameras: Camera[]
  restaurantId: string
}

// Get WebSocket URL from API base URL
function getWebSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
  const baseUrl = apiUrl.replace('/api/v1', '')
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
  return baseUrl.replace(/^https?/, wsProtocol) + '/ws/demo'
}

export function MultiCameraView({ isOpen, onClose, cameras, restaurantId }: MultiCameraViewProps) {
  const [demoStarted, setDemoStarted] = useState(false)
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set())
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const demoWs = useRef<DemoWebSocket>()

  const initializeFromBackend = useRestaurantStore((s) => s.initializeFromBackend)
  const startDemo = useRestaurantStore((s) => s.startDemo)
  const handleTableStateUpdate = useRestaurantStore((s) => s.handleTableStateUpdate)
  const setWsConnected = useRestaurantStore((s) => s.setWsConnected)

  // Start demo when viewer opens
  useEffect(() => {
    if (isOpen && !demoStarted) {
      initDemo()
    }

    return () => {
      if (demoWs.current) {
        demoWs.current.disconnect()
      }
    }
  }, [isOpen])

  const initDemo = async () => {
    try {
      console.log('[MultiCameraView] Initializing demo...')

      // 1. Load initial data from backend
      await initializeFromBackend(restaurantId)

      // 2. Start demo
      await startDemo(restaurantId)

      // 3. Connect WebSocket
      const wsUrl = getWebSocketUrl()
      console.log('[MultiCameraView] Connecting to WebSocket:', wsUrl)

      demoWs.current = new DemoWebSocket()
      demoWs.current.connect(
        wsUrl,
        (event) => {
          handleTableStateUpdate(event)
          setWsConnected(true)
        },
        () => {
          console.error('[MultiCameraView] WebSocket connection failed')
          setWsConnected(false)
          // NO FALLBACK - Backend must be working
        }
      )

      setDemoStarted(true)
    } catch (error) {
      console.error('[MultiCameraView] Demo init failed:', error)
      // No fallback - backend must be working
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50"
          />

          {/* Multi-Camera Grid */}
          <motion.div
            key="grid"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-20 z-50"
      >
        <div className="glass-panel p-4 rounded-xl border border-white/10 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-display text-primary">Multi-Camera Demo View</h3>
              <p className="text-sm text-secondary">Computer vision processing - All cameras</p>
            </div>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Camera Grid - 3x3 */}
          <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-3">
            {cameras.map((camera) => (
              <motion.div
                key={camera.id}
                className="relative bg-black rounded-lg overflow-hidden group"
                whileHover={{ scale: selectedCamera ? 1 : 1.02 }}
              >
                {/* Camera Label */}
                <div className="absolute top-2 left-2 z-10 glass-panel-flat px-3 py-1 rounded-lg">
                  <span className="text-xs font-semibold text-primary">{camera.name}</span>
                </div>

                {/* Maximize Button */}
                <button
                  onClick={() => setSelectedCamera(selectedCamera === camera.id ? null : camera.id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-lg glass-panel-flat flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* Video or Placeholder */}
                {camera.active && camera.videoPath && !failedVideos.has(camera.id) ? (
                  <video
                    ref={(el) => (videoRefs.current[camera.id] = el)}
                    src={camera.videoPath}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={() => {
                      console.warn(`[Camera] Video failed to load: ${camera.videoPath}`)
                      setFailedVideos(prev => new Set([...prev, camera.id]))
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <Video className="w-8 h-8 text-white/30 mx-auto mb-2" />
                      <span className="text-xs text-white/40">
                        {failedVideos.has(camera.id) ? 'Video not found' : 'No feed'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Live Indicator */}
                {demoStarted && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-2 glass-panel-flat px-2 py-1 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-primary">LIVE</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Status Info */}
          {demoStarted && (
            <div className="mt-4 p-3 glass-panel-flat rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-primary">Demo active - {cameras.length} cameras streaming</span>
                <span className="text-tertiary ml-auto">Tables updating in real-time</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

          {/* Fullscreen Modal for Selected Camera */}
          {selectedCamera && (
            <motion.div
              key="fullscreen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCamera(null)}
              className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
            >
              <div className="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center">
                <button
                  onClick={() => setSelectedCamera(null)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 rounded-lg glass-panel flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
                <video
                  src={cameras.find(c => c.id === selectedCamera)?.videoPath}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  loop
                />
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
