import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'
import { DemoWebSocket } from '../../../shared/services/websocket'
import { mockTables, mockGuests, mockReservations, mockServers, mockSections, mockActivity, mockRecommendations } from '../../data/mockData'

interface VideoViewerProps {
  isOpen: boolean
  onClose: () => void
  videoPath: string
  restaurantId: string
}

// Get WebSocket URL from API base URL
function getWebSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
  const baseUrl = apiUrl.replace('/api/v1', '')
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
  return baseUrl.replace(/^https?/, wsProtocol) + '/ws/demo'
}

export function VideoViewer({ isOpen, onClose, videoPath, restaurantId }: VideoViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [demoStarted, setDemoStarted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const demoWs = useRef<DemoWebSocket>()

  const initializeFromBackend = useRestaurantStore((s) => s.initializeFromBackend)
  const startDemo = useRestaurantStore((s) => s.startDemo)
  const handleTableStateUpdate = useRestaurantStore((s) => s.handleTableStateUpdate)
  const setWsConnected = useRestaurantStore((s) => s.setWsConnected)

  const attemptPlayback = (video: HTMLVideoElement | null) => {
    if (!video) return

    video.defaultMuted = true
    video.muted = true
    video.playsInline = true
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((error) => {
        if (error?.name !== 'AbortError') {
          console.warn('[VideoViewer] Playback requires interaction:', error?.message || error)
        }
      })
    }
  }

  // Start demo when video viewer opens
  useEffect(() => {
    if (isOpen && !demoStarted) {
      initDemo()
    }

    return () => {
      // Cleanup WebSocket on close
      if (demoWs.current) {
        demoWs.current.disconnect()
      }
    }
  }, [isOpen])

  const initDemo = async () => {
    try {
      console.log('[VideoViewer] Initializing demo...')

      // 1. Load initial data from backend
      await initializeFromBackend(restaurantId)

      // 2. Start demo
      await startDemo(restaurantId)

      // 3. Connect WebSocket
      const wsUrl = getWebSocketUrl()
      console.log('[VideoViewer] Connecting to WebSocket:', wsUrl)

      demoWs.current = new DemoWebSocket()
      demoWs.current.connect(
        wsUrl,
        (event) => {
          handleTableStateUpdate(event)
          setWsConnected(true)
        },
        () => {
          // Fallback: use mock data
          console.warn('[VideoViewer] WebSocket failed, using mock data')
          setWsConnected(false)
          useRestaurantStore.setState({
            tables: mockTables,
            guests: mockGuests,
            reservations: mockReservations,
            servers: mockServers,
            sections: mockSections,
            activity: mockActivity,
            recommendations: mockRecommendations,
          })
        }
      )

      setDemoStarted(true)
      setIsPlaying(true)
      attemptPlayback(videoRef.current)
    } catch (error) {
      console.error('[VideoViewer] Demo init failed:', error)
      // Fallback to mock data
      useRestaurantStore.setState({
        tables: mockTables,
        guests: mockGuests,
        reservations: mockReservations,
        servers: mockServers,
        sections: mockSections,
        activity: mockActivity,
        recommendations: mockRecommendations,
      })
    }
  }

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        attemptPlayback(videoRef.current)
      }
      setIsPlaying(!isPlaying)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    const triggerPlayback = () => attemptPlayback(videoRef.current)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerPlayback()
      }
    }

    const timer = window.setTimeout(triggerPlayback, 150)
    window.addEventListener('focus', triggerPlayback)
    window.addEventListener('pointerdown', triggerPlayback)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', triggerPlayback)
      window.removeEventListener('pointerdown', triggerPlayback)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isOpen, videoPath])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
      />

      {/* Video Player */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl"
      >
        <div className="glass-panel p-4 rounded-xl border border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-display text-primary">Live Feed</h3>
              <p className="text-sm text-secondary">Computer vision processing in real-time</p>
            </div>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Video Container */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              src={videoPath}
              className="w-full h-full"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onCanPlay={(e) => attemptPlayback(e.currentTarget)}
              onLoadedData={(e) => attemptPlayback(e.currentTarget)}
              controls
            >
              Your browser does not support the video tag.
            </video>

            {/* Play/Pause Overlay */}
            {!isPlaying && (
              <button
                onClick={togglePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors"
              >
                <Play className="w-16 h-16 text-white" />
              </button>
            )}
          </div>

          {/* Status Info */}
          {demoStarted && (
            <div className="mt-4 p-3 glass-panel-flat rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-primary">Live - Tables updating in real-time</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
