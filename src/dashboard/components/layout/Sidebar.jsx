import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  UtensilsCrossed,
  BarChart3,
  Star,
  Settings
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Staff', path: '/staff' },
  { icon: CalendarDays, label: 'Schedule', path: '/schedule' },
  { icon: UtensilsCrossed, label: 'Menu', path: '/menu' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Star, label: 'Reviews', path: '/reviews' },
]

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col py-6 fixed left-0 top-0 bottom-0 z-50">
      {/* Brand */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-bold text-lg rounded-xl shadow-lg">
            S
          </div>
          <span className="font-bold text-gray-900 tracking-tight text-lg">Shire System</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <div className="px-3 mb-3 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Menu</div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <item.icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer / Settings */}
      <div className="mt-auto px-3 pt-4 border-t border-gray-100">
        <NavLink
          to="/settings"
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
            ${isActive
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
          `}
        >
          <Settings size={18} strokeWidth={2} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  )
}
