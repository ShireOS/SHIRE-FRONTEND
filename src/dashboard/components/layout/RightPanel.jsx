import { ChevronRight, Sparkles } from 'lucide-react'
import { quickStats, alerts } from '../../data/mockData'

export function RightPanel({ onOpenChat }) {
  return (
    <aside className="w-80 bg-gray-50/50 border-l border-gray-100 p-4 space-y-4 overflow-y-auto">
      {/* AI Chat Preview - Premium Card */}
      <div className="overflow-hidden rounded-2xl shadow-lg">
        <div className="p-5 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold">AI Assistant</p>
              <p className="text-blue-100 text-xs">Ask anything about your restaurant</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white">
          <p className="text-xs text-gray-400 mb-1">Last insight:</p>
          <p className="text-sm text-gray-700 leading-relaxed">"Consider calling an extra server for 7-9pm tonight."</p>
          <button
            onClick={onOpenChat}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
          >
            Open Chat
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Stats</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Tables Open</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{quickStats.tablesOpen}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Staff On</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{quickStats.staffOn}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Wait List</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{quickStats.waitList}</span>
          </div>
        </div>
      </div>

      {/* Top Alerts */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Alerts</h3>
        <div className="space-y-3">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer"
            >
              <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${alert.severity === 'high' ? 'bg-rose-500' :
                  alert.severity === 'medium' ? 'bg-amber-500' :
                    'bg-emerald-500'
                }`} />
              <p className="text-xs text-gray-600 leading-relaxed">{alert.message}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
