import { useEffect, useLayoutEffect, useState, useRef, lazy, Suspense } from 'react'
import { TopBar } from './components/layout/TopBar'
import { SmartCarousel } from './components/layout/SmartCarousel'
import { LeftPanel } from './components/layout/LeftPanel'
import { CenterPanel } from './components/layout/CenterPanel'
import { RightPanel } from './components/layout/RightPanel'
import { DemoStatusBanner } from './components/demo/DemoStatusBanner'
import { MultiCameraView } from './components/demo/MultiCameraView'
import { useRestaurantStore } from './stores/restaurantStore'
import { useAlerts } from './hooks/useAlerts'
import {
  START_SCENE_INDEX,
  getWalkthroughCameras,
  getWalkthroughSnapshot,
} from '../fake-host-ui/data/walkthroughDemo'

// Detect if we're on the fake host demo route
const IS_FAKE_HOST = window.location.pathname.startsWith('/fake-host-ui')

// Use the correct Mimosas restaurant ID
const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || 'c74e9278-1ccb-4f75-bc2f-eacf054db608'

// Configure 9 camera feeds (cam-2 through cam-11, skipping cam-1 and cam-10)
const CAMERAS = [
  { id: 'cam-2', name: 'Camera 2', videoPath: '/demovids/cam1.mp4', active: true },
  { id: 'cam-3', name: 'Camera 3', videoPath: '/demovids/cam2.mp4', active: true },
  { id: 'cam-4', name: 'Camera 4', videoPath: '/demovids/cam3.mp4', active: true },
  { id: 'cam-5', name: 'Camera 5', videoPath: '/demovids/cam4.mp4', active: true },
  { id: 'cam-6', name: 'Camera 6', videoPath: '/demovids/cam5.mp4', active: true },
  { id: 'cam-7', name: 'Camera 7', videoPath: '/demovids/cam6.mp4', active: true },
  { id: 'cam-8', name: 'Camera 8', videoPath: '/demovids/cam7.mp4', active: true },
  { id: 'cam-9', name: 'Camera 9', videoPath: '/demovids/cam8.mp4', active: true },
  { id: 'cam-11', name: 'Camera 11', videoPath: '/demovids/cam9.mp4', active: true },
]

function App() {
  const theme = useRestaurantStore((s) => s.theme)
  const [videoViewerOpen, setVideoViewerOpen] = useState(false)
  const demoInitialized = useRef(false)

  const initializeFromBackend = useRestaurantStore((s) => s.initializeFromBackend)
  const startDemo = useRestaurantStore((s) => s.startDemo)

  // Connect SSE stream for real-time waiter alerts
  useAlerts(RESTAURANT_ID)

  // Initialize theme class on document
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  // Preload fake-host walkthrough before first paint so the demo appears already in motion.
  useLayoutEffect(() => {
    if (demoInitialized.current) return

    if (IS_FAKE_HOST) {
      demoInitialized.current = true
      useRestaurantStore.setState({
        ...getWalkthroughSnapshot(START_SCENE_INDEX),
        demoActive: true,
        demoStatus: { speed: 1.0, cameras: getWalkthroughCameras() },
        wsConnected: true,
        lastCvUpdate: new Date(),
      })
      console.log('[FakeHost] Offline walkthrough scene loaded')
    }
  }, [])

  // Auto-start real host demo on mount.
  useEffect(() => {
    if (demoInitialized.current || IS_FAKE_HOST) return
    demoInitialized.current = true

    const initAndStartDemo = async () => {
      console.log('[App] Auto-initializing and starting demo...')
      await initializeFromBackend(RESTAURANT_ID)
      await startDemo(RESTAURANT_ID)
      console.log('[App] Demo started automatically')
    }

    initAndStartDemo()
  }, [initializeFromBackend, startDemo])

  return (
    <div className="w-full h-full flex flex-col bg-base">
      {/* Top Bar */}
      <TopBar onOpenVideoViewer={() => setVideoViewerOpen(true)} />

      {/* Demo Status Banner */}
      {!IS_FAKE_HOST && <DemoStatusBanner />}

      {/* Smart Carousel */}
      <SmartCarousel />

      {/* Main Content: 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Waitlist / Reservations */}
        <LeftPanel />

        {/* Center Panel: Floor Plan */}
        <CenterPanel />

        {/* Right Panel: Activity Feed */}
        <RightPanel />
      </div>

      {/* Multi-Camera Viewer */}
      <MultiCameraView
        isOpen={videoViewerOpen}
        onClose={() => setVideoViewerOpen(false)}
        cameras={CAMERAS}
        restaurantId={RESTAURANT_ID}
      />

      {/* Simulation runner for fake host mode */}
      {IS_FAKE_HOST && <Suspense fallback={null}><SimulationRunner /></Suspense>}
    </div>
  )
}

// Lazy-loaded simulation runner for fake host mode (never bundled for real host)
const SimulationRunner = lazy(() =>
  import('../fake-host-ui/hooks/useSimulation').then((mod) => ({
    default: () => { mod.useSimulation(); return null },
  }))
)

export default App
