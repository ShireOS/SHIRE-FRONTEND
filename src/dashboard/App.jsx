import { Component, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { isSupabaseConfigured, supabaseConfigError } from '../shared/lib/supabase'

// Detect if we're on the fake dashboard demo route
const IS_FAKE_DEMO = window.location.pathname.startsWith('/fake-dashboard-demo')
const AuthenticatedDashboardApp = lazy(() => import('./AuthenticatedDashboardApp'))

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

class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: null,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Dashboard] Render failed:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h1 className="text-xl font-semibold">Dashboard failed to load</h1>
            <p className="text-sm text-white/75">
              A runtime error prevented this page from rendering.
            </p>
            {!isSupabaseConfigured && (
              <p className="text-sm text-amber-300">
                {supabaseConfigError}
              </p>
            )}
            {this.state.errorMessage && (
              <pre className="text-xs bg-black/50 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                {this.state.errorMessage}
              </pre>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
              >
                Reload page
              </button>
              <a
                href="/dashboard/auth/login"
                className="px-4 py-2 rounded-lg border border-white/20 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Go to login
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
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
            <Outlet />
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
      <DashboardErrorBoundary>
        <Routes>
          <Route element={<FakeDashboardLayout />}>
            <Route index element={<FakeDashboard />} />
            <Route path="staff" element={<FakeStaff />} />
            <Route path="staff/:id" element={<FakeStaff />} />
            <Route path="schedule" element={<FakeSchedule />} />
            <Route path="menu" element={<FakeMenu />} />
            <Route path="analytics" element={<FakeAnalytics />} />
            <Route path="reviews" element={<FakeReviews />} />
            <Route path="settings" element={<FakeSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardErrorBoundary>
    )
  }

  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-dash-base flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dash-gold" /></div>}>
        <AuthenticatedDashboardApp />
      </Suspense>
    </DashboardErrorBoundary>
  )
}
