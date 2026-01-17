import { Routes, Route } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { RightPanel } from './components/layout/RightPanel'
import { Dashboard } from './pages/Dashboard'
import { Staff } from './pages/Staff'
import { Schedule } from './pages/Schedule'
import { Menu } from './pages/Menu'
import { Analytics } from './pages/Analytics'
import { Reviews } from './pages/Reviews'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <div className="min-h-screen bg-white text-primary font-body selection:bg-black selection:text-white">
      {/* Header */}
      <Header />

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto min-h-[calc(100vh-4rem)] ml-64">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/staff/:id" element={<Staff />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* Right Panel */}
        <RightPanel />
      </div>
    </div>
  )
}
