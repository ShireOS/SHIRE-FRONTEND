import { useEffect, useState } from 'react'
import { TopBar } from './components/layout/TopBar'
import { SmartCarousel } from './components/layout/SmartCarousel'
import { LeftPanel } from './components/layout/LeftPanel'
import { CenterPanel } from './components/layout/CenterPanel'
import { RightPanel } from './components/layout/RightPanel'
import { DemoStatusBanner } from './components/demo/DemoStatusBanner'
import { MultiCameraView } from './components/demo/MultiCameraView'
import { useRestaurantStore } from './stores/restaurantStore'

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || '550e8400-e29b-41d4-a716-446655440000'

// Configure 9 camera feeds (only 4 will have videos)
const CAMERAS = [
  { id: 'cam-1', name: 'Camera 1', videoPath: '/demovids/demo1.mp4', active: true },
  { id: 'cam-2', name: 'Camera 2', videoPath: '/demovids/demo2.mp4', active: true },
  { id: 'cam-3', name: 'Camera 3', videoPath: '/demovids/demo3.mp4', active: true },
  { id: 'cam-4', name: 'Camera 4', videoPath: '/demovids/demo4.mp4', active: true },
  { id: 'cam-5', name: 'Camera 5', videoPath: '', active: false },
  { id: 'cam-6', name: 'Camera 6', videoPath: '', active: false },
  { id: 'cam-7', name: 'Camera 7', videoPath: '', active: false },
  { id: 'cam-8', name: 'Camera 8', videoPath: '', active: false },
  { id: 'cam-9', name: 'Camera 9', videoPath: '', active: false },
]

function App() {
  const theme = useRestaurantStore((s) => s.theme)
  const [videoViewerOpen, setVideoViewerOpen] = useState(false)

  // Initialize theme class on document
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  return (
    <div className="w-full h-full flex flex-col bg-base">
      {/* Top Bar */}
      <TopBar onOpenVideoViewer={() => setVideoViewerOpen(true)} />

      {/* Demo Status Banner */}
      <DemoStatusBanner />

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
    </div>
  )
}

export default App
