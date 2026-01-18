import { ChevronRight, Star, AlertTriangle, Loader2, WifiOff, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStaffTodayWithStatus } from '../../hooks/useStaffData'

export function StaffLeaderboard() {
  const navigate = useNavigate()
  const { staffToday, isLoading, isError, error, refetch } = useStaffTodayWithStatus()

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full p-6 rounded-lg glass-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg text-dash-cream">
            Staff <span className="font-dash-display italic text-dash-gold">Rank</span>
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-dash-tertiary" />
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="h-full p-6 rounded-lg glass-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg text-dash-cream">
            Staff <span className="font-dash-display italic text-dash-gold">Rank</span>
          </h3>
        </div>
        <div className="text-center py-4">
          <WifiOff size={24} className="text-dash-danger mx-auto mb-2" />
          <p className="text-xs text-dash-tertiary mb-2">{error?.message || 'Cannot load'}</p>
          <button
            onClick={refetch}
            className="text-xs text-dash-gold hover:text-dash-cream flex items-center gap-1 mx-auto"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    )
  }

  const topTips = staffToday.length > 0 ? Math.max(...staffToday.map(s => s.tips)) : 1

  return (
    <div className="h-full p-6 rounded-lg glass-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-dash-cream">
          Staff <span className="font-dash-display italic text-dash-gold">Rank</span>
        </h3>
        <button
          onClick={() => navigate('/staff')}
          className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-dash-border hover:border-dash-gold/30"
        >
          VIEW TEAM <ChevronRight size={12} />
        </button>
      </div>

      <div className="space-y-1">
        {staffToday.map((member) => {
          const progress = (member.tips / topTips) * 100

          return (
            <div
              key={member.id}
              onClick={() => navigate(`/staff/${member.id}`)}
              className="group flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-dash-border"
            >
              {/* Rank */}
              <span className={`w-5 text-sm font-dash-mono font-bold text-center ${
                member.rank === 1 ? 'text-dash-gold' : 'text-dash-secondary'
              }`}>
                {member.rank}
              </span>

              {/* Avatar - Minimal */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold tracking-tighter ${
                member.rank === 1
                  ? 'bg-dash-gold/20 text-dash-gold border border-dash-gold/30'
                  : 'bg-white/10 text-dash-cream border border-dash-border'
              }`}>
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-dash-cream truncate">{member.name}</p>
                  {member.rank === 1 && <Star size={12} className="text-dash-gold fill-dash-gold" />}
                  {member.warning && <AlertTriangle size={12} className="text-dash-danger" />}
                </div>
                <div className="flex items-center gap-2 label-mono">
                  <span>{member.covers} CVRS</span>
                  <span>·</span>
                  <span>${member.avgTip.toFixed(2)} AVG</span>
                </div>
              </div>

              {/* Tips & Progress */}
              <div className="text-right w-24">
                <p className="text-sm font-bold text-dash-cream tabular-nums font-dash-mono">${member.tips}</p>
                <div className="w-full h-1 bg-white/10 rounded-sm mt-1 overflow-hidden">
                  <div
                    className={`h-full ${member.rank === 1 ? 'bg-dash-gold' : 'bg-dash-secondary'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
