// Suggested Prompts Component
// Shows quick action buttons for common questions

import { MessageSquare, TrendingUp, Users, Calendar, Star } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  {
    icon: TrendingUp,
    label: 'Top menu items',
    prompt: 'What are my top menu items this month?'
  },
  {
    icon: Users,
    label: 'Staff performance',
    prompt: 'Any staff performance concerns I should know about?'
  },
  {
    icon: Calendar,
    label: 'Scheduling gaps',
    prompt: 'Show me scheduling gaps for this week'
  },
  {
    icon: Star,
    label: 'Recent reviews',
    prompt: 'Summarize my recent customer reviews'
  }
]

export function SuggestedPrompts({ onPromptClick }) {
  return (
    <div className="px-4 py-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-dash-gold/20 border border-dash-gold/30 mb-3">
          <MessageSquare size={24} className="text-dash-gold" />
        </div>
        <h3 className="text-lg font-semibold text-dash-cream mb-1">
          Ask me anything
        </h3>
        <p className="text-sm text-dash-tertiary">
          Get insights about your restaurant's performance
        </p>
      </div>

      <div className="space-y-2">
        {SUGGESTED_PROMPTS.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={index}
              onClick={() => onPromptClick(item.prompt)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-dash-cream/5 border border-dash-border hover:border-dash-gold/30 hover:bg-dash-cream/10 transition-all text-left group"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-dash-gold/20 group-hover:bg-dash-gold/30 flex items-center justify-center transition-colors">
                <Icon size={16} className="text-dash-gold" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-dash-cream">{item.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 p-3 rounded-xl bg-dash-gold/10 border border-dash-gold/20">
        <p className="text-xs text-dash-secondary leading-relaxed">
          <strong>Tip:</strong> I have access to your reviews, menu analytics, staff performance, scheduling, and revenue data.
        </p>
      </div>
    </div>
  )
}
