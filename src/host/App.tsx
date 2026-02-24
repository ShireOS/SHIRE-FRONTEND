import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { TopBar } from './components/layout/TopBar'
import { SmartCarousel } from './components/layout/SmartCarousel'
import { LeftPanel } from './components/layout/LeftPanel'
import { CenterPanel } from './components/layout/CenterPanel'
import { RightPanel } from './components/layout/RightPanel'
import { DemoStatusBanner } from './components/demo/DemoStatusBanner'
import { MultiCameraView } from './components/demo/MultiCameraView'
import { useRestaurantStore } from './stores/restaurantStore'

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

  // Initialize theme class on document
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  // Auto-start demo on mount (runs once)
  useEffect(() => {
    if (demoInitialized.current) return
    demoInitialized.current = true

    if (IS_FAKE_HOST) {
      // Fake host mode: load Mimosas data locally and start simulation
      import('../fake-host-ui/data/mimosasMockData').then((mimosas) => {
        useRestaurantStore.setState({
          tables: mimosas.mockTables,
          guests: mimosas.mockGuests,
          reservations: mimosas.mockReservations,
          servers: mimosas.mockServers,
          sections: mimosas.mockSections,
          activity: mimosas.mockActivity,
          recommendations: mimosas.mockRecommendations,
          demoActive: true,
          demoStatus: { speed: 1.0, cameras: [] },
        })
        console.log('[FakeHost] Mimosas data loaded - no backend needed')
      })
    } else {
      // Real host mode: connect to backend
      const initAndStartDemo = async () => {
        console.log('[App] Auto-initializing and starting demo...')
        await initializeFromBackend(RESTAURANT_ID)
        await startDemo(RESTAURANT_ID)
        console.log('[App] Demo started automatically')
      }
      initAndStartDemo()
    }
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
