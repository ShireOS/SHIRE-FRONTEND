import { Search, Command } from 'lucide-react'

export function Header() {
  return (
    <header className="h-16 pl-72 pr-8 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-40">

      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-400">Dashboard</span>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">Overview</span>

        <div className="ml-4 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Service
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-5">
        {/* Search Input - Modern */}
        <div className="relative group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
          <input
            type="text"
            placeholder="Search database..."
            className="pl-11 pr-12 py-2.5 w-72 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
            <Command size={10} /> K
          </kbd>
        </div>

        <div className="h-8 w-px bg-gray-200"></div>

        {/* User Block */}
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">Cameron K.</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Admin</div>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-lg">
            CK
          </div>
        </div>
      </div>
    </header>
  )
}
