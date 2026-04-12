import { useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import {
  AuthProvider,
  useRequireAuth,
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  AuthCallbackPage,
} from '../auth'
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
import { Reservations } from './pages/Reservations'
import { Settings } from './pages/Settings'

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
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto min-h-[calc(100vh-4rem)] ml-64">
          <Outlet />
        </main>
        <RightPanel onOpenChat={() => setIsChatOpen(true)} />
      </div>
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}

export default function AuthenticatedDashboardApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="auth/login" element={<LoginPage />} />
        <Route path="auth/signup" element={<SignupPage />} />
        <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route path="dev-onboarding/*" element={<OnboardingPage />} />
        <Route path="onboarding/*" element={<Navigate to="/dev-onboarding" replace />} />
        <Route element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="staff" element={<Staff />} />
          <Route path="staff/:id" element={<Staff />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="menu" element={<Menu />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
