import { useEffect } from 'react'
import { TopBar } from './components/layout/TopBar'
import { SmartCarousel } from './components/layout/SmartCarousel'
import { LeftPanel } from './components/layout/LeftPanel'
import { CenterPanel } from './components/layout/CenterPanel'
import { RightPanel } from './components/layout/RightPanel'
import { useRestaurantStore } from './stores/restaurantStore'

function App() {
  const theme = useRestaurantStore((s) => s.theme)

  // Initialize theme class on document
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  return (
    <div className="w-full h-full flex flex-col bg-base">
      {/* Top Bar */}
      <TopBar />

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
    </div>
  )
}

export default App
