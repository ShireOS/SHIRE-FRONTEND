import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarClock,
  UtensilsCrossed,
  BarChart3,
  Star,
  Settings
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Staff', path: '/staff' },
  { icon: CalendarDays, label: 'Schedule', path: '/schedule' },
  { icon: CalendarClock, label: 'Reservations', path: '/reservations' },
  { icon: UtensilsCrossed, label: 'Menu', path: '/menu' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Star, label: 'Reviews', path: '/reviews' },
]

export function Sidebar() {
  return (
    <aside className="w-64 glass-panel dashboard-sidebar flex flex-col py-6 fixed left-0 top-0 bottom-0 z-50">
      {/* Brand */}
      <div className="px-6 mb-8">
        <span className="font-dash-display text-2xl text-dash-cream tracking-wide">SHIRE</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <div className="px-3 mb-3 label-mono">Menu</div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-dash-gold/15 text-dash-gold border border-dash-gold/30 shadow-gold-glow'
                : 'text-dash-secondary hover:text-dash-cream hover:bg-dash-cream/5 border border-transparent'
              }
            `}
          >
            <item.icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer / Settings */}
      <div className="mt-auto px-3 pt-4 soft-divider-top">
        <NavLink
          to="/settings"
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
            ${isActive
              ? 'bg-dash-gold/15 text-dash-gold border border-dash-gold/30 shadow-gold-glow'
              : 'text-dash-secondary hover:text-dash-cream hover:bg-dash-cream/5 border border-transparent'}
          `}
        >
          <Settings size={18} strokeWidth={2} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  )
}
