import { Card, CardContent } from '../shared/Card'
import { Lightbulb, ChevronRight, Sparkles } from 'lucide-react'
import { aiInsights } from '../../data/mockData'

export function AIInsights() {
  // Adapt aiInsights to the new structure expected by the Studio style
  // Assuming aiInsights is an array of strings, we'll map them to objects
  // with a dummy id, category, impact, and message for demonstration.
  // In a real scenario, the mockData would be updated.
  const insights = aiInsights.map((insight, index) => ({
    id: `insight-${index}`,
    category: index % 2 === 0 ? 'Performance' : 'Engagement',
    impact: index % 3 === 0 ? 'high' : 'normal',
    message: insight,
  }));

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="h-full p-6 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-sm bg-black text-white">
              <Sparkles size={14} fill="currentColor" />
            </div>
            <h3 className="font-semibold text-gray-900 tracking-tight">Intelligence</h3>
          </div>

          <div className="space-y-4">
            {insights.map((insight) => (
              <div key={insight.id} className="group">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{insight.category}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${insight.impact === 'high' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      'bg-gray-50 border-gray-200 text-gray-600'
                    }`}>
                    {insight.impact === 'high' ? 'HIGH IMPACT' : 'NORMAL'}
                  </span>
                </div>

                <p className="text-sm font-medium text-gray-800 leading-relaxed group-hover:text-black transition-colors">
                  {insight.message}
                </p>

                <div className="h-px w-full bg-gray-200 mt-3 group-last:hidden"></div>
              </div>
            ))}

            <button className="w-full mt-2 py-2 text-xs font-semibold text-center border border-dashed border-gray-300 rounded text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-all">
              Generate New Report
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
