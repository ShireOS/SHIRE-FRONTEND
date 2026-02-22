import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useRequireAuth, LoginPage, SignupPage, ForgotPasswordPage, AuthCallbackPage } from '../auth'
import { OnboardingPage } from '../onboarding'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { RightPanel } from './components/layout/RightPanel'
import { ChatPanel } from './components/chat/ChatPanel'
import { Dashboard } from './pages/Dashboard'
import { Staff } from './pages/Staff'
import { Schedule } from './pages/Schedule'
import { Menu } from './pages/Menu'
import { Analytics } from './pages/Analytics'
import { Reviews } from './pages/Reviews'
import { Settings } from './pages/Settings'

// Detect if we're on the fake dashboard demo route
const IS_FAKE_DEMO = window.location.pathname.startsWith('/fake-dashboard-demo')

// Lazy-load fake dashboard pages (only loaded when on /fake-dashboard-demo)
const FakeDashboard = lazy(() => import('../fake-dashboard-demo/pages/FakeDashboard'))
const FakeStaff = lazy(() => import('../fake-dashboard-demo/pages/FakeStaff'))
const FakeSchedule = lazy(() => import('../fake-dashboard-demo/pages/FakeSchedule'))
const FakeMenu = lazy(() => import('../fake-dashboard-demo/pages/FakeMenu'))
const FakeAnalytics = lazy(() => import('../fake-dashboard-demo/pages/FakeAnalytics'))
const FakeReviews = lazy(() => import('../fake-dashboard-demo/pages/FakeReviews'))
const FakeSettings = lazy(() => import('../fake-dashboard-demo/pages/FakeSettings'))
const FakeRightPanel = lazy(() => import('../fake-dashboard-demo/components/FakeRightPanel'))
const FakeChatPanel = lazy(() => import('../fake-dashboard-demo/components/FakeChatPanel'))

// Protected dashboard layout - requires auth + completed onboarding
function DashboardLayout() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const { isReady } = useRequireAuth({ requireOnboarding: true })

  if (!isReady) {
    return (
      <div className="min-h-screen bg-dash-base flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dash-gold" />
      </div>
    )
  }

  return (
    <div className="dashboard-chrome min-h-screen bg-dash-base text-dash-cream font-dash-body selection:bg-dash-gold selection:text-dash-base">
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
        <RightPanel onOpenChat={() => setIsChatOpen(true)} />
      </div>

      {/* Chat Panel */}
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}

// Fake dashboard layout - no auth required, uses Mimosas data
function FakeDashboardLayout() {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="dashboard-chrome min-h-screen bg-dash-base text-dash-cream font-dash-body selection:bg-dash-gold selection:text-dash-base">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto min-h-[calc(100vh-4rem)] ml-64">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dash-gold" /></div>}>
            <Routes>
              <Route path="/" element={<FakeDashboard />} />
              <Route path="/staff" element={<FakeStaff />} />
              <Route path="/staff/:id" element={<FakeStaff />} />
              <Route path="/schedule" element={<FakeSchedule />} />
              <Route path="/menu" element={<FakeMenu />} />
              <Route path="/analytics" element={<FakeAnalytics />} />
              <Route path="/reviews" element={<FakeReviews />} />
              <Route path="/settings" element={<FakeSettings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <FakeRightPanel onOpenChat={() => setIsChatOpen(true)} />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <FakeChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </Suspense>
    </div>
  )
}

export default function App() {
  // Fake demo mode: skip auth entirely, render fake layout directly
  if (IS_FAKE_DEMO) {
    return (
      <Routes>
        <Route path="/*" element={<FakeDashboardLayout />} />
      </Routes>
    )
  }

  return (
    <AuthProvider>
      <Routes>
        {/* Auth routes - public */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignupPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Onboarding - requires auth, not completed onboarding */}
        <Route path="/onboarding/*" element={<OnboardingPage />} />

        {/* Dashboard routes - protected */}
        <Route path="/*" element={<DashboardLayout />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
