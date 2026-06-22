import { Component, lazy, Suspense } from 'react'
import { isSupabaseConfigured, supabaseConfigError } from '../shared/lib/supabase'

const AuthenticatedDashboardApp = lazy(() => import('./AuthenticatedDashboardApp'))

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
                href="/auth/login"
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

export default function App() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-dash-base flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-dash-gold" /></div>}>
        <AuthenticatedDashboardApp />
      </Suspense>
    </DashboardErrorBoundary>
  )
}
