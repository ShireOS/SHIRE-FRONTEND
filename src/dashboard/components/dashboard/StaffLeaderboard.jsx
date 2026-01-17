import { ChevronRight, Star, AlertTriangle, Loader2, WifiOff, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStaffTodayWithStatus } from '../../hooks/useStaffData'

export function StaffLeaderboard() {
  const navigate = useNavigate()
  const { staffToday, isLoading, isError, error, refetch } = useStaffTodayWithStatus()

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full p-6 rounded-lg bg-surface border border-border shadow-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg text-primary">Staff Rank</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="h-full p-6 rounded-lg bg-surface border border-border shadow-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg text-primary">Staff Rank</h3>
        </div>
        <div className="text-center py-4">
          <WifiOff size={24} className="text-red-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-2">{error?.message || 'Cannot load'}</p>
          <button
            onClick={refetch}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    )
  }

  const topTips = staffToday.length > 0 ? Math.max(...staffToday.map(s => s.tips)) : 1

  return (
    <div className="h-full p-6 rounded-lg bg-surface border border-border shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-primary">Staff Rank</h3>
        <button
          onClick={() => navigate('/staff')}
          className="text-xs font-mono font-medium text-secondary hover:text-primary flex items-center gap-1 transition-colors uppercase tracking-wider bg-app px-2 py-1 rounded border border-border"
        >
          View Team <ChevronRight size={12} />
        </button>
      </div>

      <div className="space-y-1">
        {staffToday.map((member) => {
          const progress = (member.tips / topTips) * 100

          return (
            <div
              key={member.id}
              onClick={() => navigate(`/staff/${member.id}`)}
              className="group flex items-center gap-3 p-3 rounded-md hover:bg-app cursor-pointer transition-colors border border-transparent hover:border-border"
            >
              {/* Rank */}
              <span className="w-5 text-sm font-mono font-bold text-secondary text-center">
                {member.rank}
              </span>

              {/* Avatar - Minimal */}
              <div className="w-8 h-8 bg-black text-white rounded-sm flex items-center justify-center text-xs font-bold tracking-tighter">
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary truncate">{member.name}</p>
                  {member.rank === 1 && <Star size={12} className="text-amber-500 fill-amber-500" />}
                  {member.warning && <AlertTriangle size={12} className="text-red-500" />}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-secondary uppercase tracking-wide font-mono">
                  <span>{member.covers} CVRS</span>
                  <span>·</span>
                  <span>${member.avgTip.toFixed(2)} AVG</span>
                </div>
              </div>

              {/* Tips & Progress */}
              <div className="text-right w-24">
                <p className="text-sm font-bold text-primary tabular-nums font-mono">${member.tips}</p>
                <div className="w-full h-1 bg-gray-100 rounded-sm mt-1 overflow-hidden">
                  <div
                    className={`h-full ${member.rank === 1 ? 'bg-black' : 'bg-gray-400'}`}
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
