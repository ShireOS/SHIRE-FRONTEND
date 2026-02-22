import { ChevronRight, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { staffToday } from '../data/mimosasMockData'

export function FakeStaffLeaderboard() {
  const navigate = useNavigate()
  const topTips = staffToday.length > 0 ? Math.max(...staffToday.map(s => s.tips)) : 1

  return (
    <div className="h-full p-6 rounded-lg glass-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-dash-cream">Staff <span className="font-dash-display italic text-dash-gold">Rank</span></h3>
        <button onClick={() => navigate('/staff')} className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors bg-dash-cream/5 px-3 py-1.5 rounded-lg border border-dash-border hover:border-dash-gold/30">VIEW TEAM <ChevronRight size={12} /></button>
      </div>
      <div className="space-y-2">
        {staffToday.map((member) => {
          const progress = (member.tips / topTips) * 100
          return (
            <div key={member.id} onClick={() => navigate(`/staff/${member.id}`)} className="group leaderboard-row p-3.5 rounded-lg cursor-pointer transition-all duration-200">
              <div className="flex items-start gap-3">
                <span className={`w-6 pt-1 text-base font-dash-mono font-bold text-center ${member.rank === 1 ? 'text-dash-gold' : 'text-dash-secondary'}`}>{member.rank}</span>
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold tracking-tighter ${member.rank === 1 ? 'bg-dash-gold/20 text-dash-gold border border-dash-gold/30' : 'bg-dash-cream/10 text-dash-cream soft-avatar-ring'}`}>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-medium text-dash-cream truncate">{member.name}</p>
                        {member.rank === 1 && <Star size={12} className="text-dash-gold fill-dash-gold" />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 label-mono"><span>{member.covers} CVRS</span><span>·</span><span>${member.avgTip.toFixed(2)} AVG</span></div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[30px] leading-none font-dash-display text-dash-cream tabular-nums">${member.tips}</p>
                      <p className="label-mono mt-1">Tips</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-dash-cream/10 rounded-sm mt-2 overflow-hidden soft-progress-track">
                    <div className={`h-full ${member.rank === 1 ? 'bg-dash-gold' : 'bg-dash-secondary'}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
