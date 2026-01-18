import { Sparkles } from 'lucide-react'
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
    <div className="h-full p-6 rounded-lg glass-card">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-dash-gold/20 text-dash-gold border border-dash-gold/30">
          <Sparkles size={14} fill="currentColor" />
        </div>
        <h3 className="font-semibold text-dash-cream tracking-tight">
          <span className="font-dash-display italic text-dash-gold">Intelligence</span>
        </h3>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => (
          <div key={insight.id} className="group">
            <div className="flex items-start justify-between mb-1">
              <span className="label-mono">{insight.category.toUpperCase()}</span>
              <span className={`label-mono px-1.5 py-0.5 rounded border ${
                insight.impact === 'high'
                  ? 'bg-dash-gold/20 border-dash-gold/30 text-dash-gold'
                  : 'bg-white/5 border-dash-border text-dash-tertiary'
              }`}>
                {insight.impact === 'high' ? 'HIGH IMPACT' : 'NORMAL'}
              </span>
            </div>

            <p className="text-sm font-medium text-dash-cream leading-relaxed group-hover:text-dash-gold transition-colors">
              {insight.message}
            </p>

            <div className="h-px w-full bg-dash-border mt-3 group-last:hidden"></div>
          </div>
        ))}

        <button className="w-full mt-2 py-2 label-mono text-center border border-dashed border-dash-border rounded-lg text-dash-tertiary hover:text-dash-gold hover:border-dash-gold/30 transition-all">
          GENERATE NEW REPORT
        </button>
      </div>
    </div>
  )
}
