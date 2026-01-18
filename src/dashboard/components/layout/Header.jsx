import { Search, Command } from 'lucide-react'

export function Header() {
  return (
    <header className="h-16 pl-72 pr-8 flex items-center justify-between border-b border-dash-border bg-transparent sticky top-0 z-40">

      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-dash-tertiary">Dashboard</span>
        <span className="text-dash-tertiary">/</span>
        <span className="font-semibold text-dash-cream">Overview</span>

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
            className="pl-11 pr-12 py-2.5 w-72 text-sm bg-white/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50 focus:ring-1 focus:ring-dash-gold/20 transition-all placeholder:text-dash-tertiary"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-dash-tertiary bg-white/5 border border-dash-border rounded px-1.5 py-0.5 flex items-center gap-0.5">
            <Command size={10} /> K
          </kbd>
        </div>

        <div className="h-8 w-px bg-dash-border"></div>

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
