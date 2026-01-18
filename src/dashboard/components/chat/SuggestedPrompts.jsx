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
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 mb-3">
          <MessageSquare size={24} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Ask me anything
        </h3>
        <p className="text-sm text-gray-500">
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
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                <Icon size={16} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 p-3 rounded-xl bg-blue-50 border border-blue-100">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Tip:</strong> I have access to your reviews, menu analytics, staff performance, scheduling, and revenue data.
        </p>
      </div>
    </div>
  )
}
