import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid'
import { Sparkles, ChevronLeft, ChevronRight, Send, Plus, AlertTriangle } from 'lucide-react'
import { schedule, aiScheduleSuggestion } from '../data/mockData'

export function Schedule() {
  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-600 mt-1">Plan and manage your team's shifts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={<Sparkles size={18} />}>
            AI Suggest
          </Button>
          <Button icon={<Send size={18} />}>
            Publish
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={18} />} />
          <span className="text-lg font-semibold text-gray-900">Week of {schedule.weekOf}</span>
          <Button variant="ghost" size="sm" icon={<ChevronRight size={18} />} />
        </div>
        <Button variant="outline" size="sm" icon={<Plus size={16} />}>
          Add Shift
        </Button>
      </div>

      {/* AI Recommendation Banner */}
      <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">AI Recommendation</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{aiScheduleSuggestion.text}</p>
              <div className="flex items-center gap-3 mt-3">
                <Button size="sm">Apply Suggestions</Button>
                <Button variant="ghost" size="sm">Dismiss</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Grid */}
      <ScheduleGrid />

      {/* Legend & Summary */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-white text-[10px]">T</span>
            <span>Training shift</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="text-xs">Busy</Badge>
            <span>Expected high traffic</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Projected Labor Cost:</span>
            <span className="ml-2 font-semibold text-gray-900">${schedule.laborCost.toLocaleString()}</span>
            <span className="ml-1 text-gray-500">({schedule.laborPercent}%)</span>
          </div>
          {schedule.warnings.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={16} />
              <span>{schedule.warnings[0]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
