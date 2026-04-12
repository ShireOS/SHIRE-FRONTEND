import { Search, Command, Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES = {
  '/': 'Overview',
  '/staff': 'Staff',
  '/schedule': 'Schedule',
  '/menu': 'Menu',
  '/analytics': 'Analytics',
  '/reviews': 'Reviews',
  '/reservations': 'Reservations',
  '/settings': 'Settings',
}

export function Header() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('dashTheme') || 'dark'
  )
  const location = useLocation()

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  )?.[1] || 'Overview'

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('dashTheme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="dashboard-topbar h-16 pl-72 pr-8 flex items-center justify-between sticky top-0 z-40">

      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-dash-tertiary">Dashboard</span>
        <span className="text-dash-tertiary">/</span>
        <span className="font-semibold text-dash-cream">{pageTitle}</span>

        <div className="ml-4 px-3 py-1.5 rounded-full bg-dash-gold/10 border border-dash-gold/30 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-dash-gold animate-pulse-gold"></span>
          <span className="label-mono text-dash-gold">LIVE</span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-5">
        {/* Search Input - Frosted */}
        <div className="relative group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dash-tertiary group-focus-within:text-dash-cream transition-colors" />
          <input
            type="text"
            placeholder="Search database..."
            className="pl-11 pr-12 py-2.5 w-72 text-sm bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50 focus:ring-1 focus:ring-dash-gold/20 transition-all placeholder:text-dash-tertiary backdrop-blur-md"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-dash-tertiary bg-dash-cream/5 border border-dash-border rounded px-1.5 py-0.5 flex items-center gap-0.5">
            <Command size={10} /> K
          </kbd>
        </div>

        <div className="topbar-divider"></div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-dash-secondary hover:text-dash-cream hover:bg-dash-cream/5 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="topbar-divider"></div>

        {/* User Block */}
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="text-right">
            <div className="text-sm font-semibold text-dash-cream">Cameron K.</div>
            <div className="label-mono">ADMIN</div>
          </div>
          <div className="w-10 h-10 bg-dash-gold/20 border border-dash-gold/30 rounded-lg flex items-center justify-center text-xs font-bold text-dash-gold">
            CK
          </div>
        </div>
      </div>
    </header>
  )
}
