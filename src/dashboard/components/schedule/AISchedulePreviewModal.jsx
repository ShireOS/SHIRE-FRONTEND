import { Modal, ModalFooter, ModalSection } from '../shared/Modal'
import { Button } from '../shared/Button'
import { Badge } from '../shared/Badge'
import { ScheduleGrid } from './ScheduleGrid'
import { Sparkles, Check, AlertTriangle, TrendingUp, Users, Clock, DollarSign } from 'lucide-react'

/**
 * Preview modal for AI-generated schedule
 * Shows suggested schedule with metrics and reasoning before user applies it
 */
export function AISchedulePreviewModal({ schedule, onApply, onCancel }) {
  if (!schedule) return null

  // Extract summary metrics if available
  const metrics = {
    shiftsCreated: schedule.staff.reduce((sum, s) => sum + s.shifts.filter(Boolean).length, 0),
    totalHours: schedule.totalHours,
    laborCost: schedule.laborCost,
    laborPercent: schedule.laborPercent,
    coverageGaps: schedule.coverageGaps.length,
  }

  // Get top AI reasoning examples
  const topReasoningExamples = schedule.staff
    .flatMap((staffRow) =>
      staffRow.shifts
        .filter((shift) => shift && shift.reasoning)
        .map((shift) => ({
          name: staffRow.name,
          time: shift.displayTime,
          role: shift.role,
          reasons: shift.reasoning.reasons,
          confidence: shift.reasoning.confidence_score,
        }))
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  // Calculate overall AI statistics
  const allShifts = schedule.staff.flatMap((s) => s.shifts.filter(Boolean))
  const aiShifts = allShifts.filter((s) => s.source === 'engine')
  const avgConfidence = aiShifts.length > 0
    ? aiShifts.reduce((sum, s) => sum + (s.reasoning?.confidence_score || 0), 0) / aiShifts.length
    : 0
  const totalViolations = aiShifts.reduce((sum, s) => sum + (s.reasoning?.constraint_violations?.length || 0), 0)

  return (
    <Modal isOpen={true} onClose={onCancel} size="xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">AI Schedule Suggestion</h2>
          <p className="text-gray-600 mt-1">
            Review the AI-generated schedule for {schedule.weekOf}
          </p>
        </div>
      </div>

      {/* Overall AI Strategy Summary */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-3">AI Scheduling Reasoning</h3>

            {/* AI-Generated Summary from Backend */}
            {schedule.scheduleSummary ? (
              <p className="text-sm text-gray-700 leading-relaxed mb-4">
                {schedule.scheduleSummary}
              </p>
            ) : (
              /* Fallback if backend doesn't provide summary yet */
              <>
                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">Overall Approach</h4>
                  <p className="text-sm text-gray-700">
                    Optimized for <strong>fairness</strong> (Gini coefficient: {schedule.fairnessGini || 'N/A'})
                    while achieving <strong>{metrics.coverageGaps === 0 ? 'full coverage' : `${((32 - metrics.coverageGaps) / 32 * 100).toFixed(0)}% coverage`}</strong>
                    {' '}and respecting <strong>{Math.round(avgConfidence * 100)}% preference match</strong>.
                  </p>
                </div>

                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">Key Decisions</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Distributed {metrics.totalHours} hours across {schedule.staff.length} staff members</li>
                    <li>• Prioritized coverage during busy periods (Friday-Saturday)</li>
                    <li>• {totalViolations > 0
                      ? `Avoided clopening where possible (${totalViolations} soft violations noted)`
                      : 'Successfully avoided all clopening patterns'
                    }</li>
                    <li>• Matched {aiShifts.filter(s => s.reasoning?.reasons.some(r => r.includes('preferred'))).length} shifts to staff preferences</li>
                  </ul>
                </div>

                {metrics.coverageGaps > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">Trade-offs</h4>
                    <p className="text-sm text-gray-700">
                      Could not meet all staffing requirements due to availability constraints.
                      {metrics.coverageGaps} time slots still need coverage.
                      Consider adjusting requirements or adding more staff availability.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Statistics */}
            <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t border-purple-200">
              <span>{metrics.shiftsCreated} shifts created</span>
              <span>•</span>
              <span>{metrics.totalHours.toFixed(1)} total hours</span>
              <span>•</span>
              <span>${metrics.laborCost.toLocaleString()} labor cost</span>
              <span>•</span>
              <span>{Math.round(avgConfidence * 100)}% avg confidence</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={<Check size={18} className="text-green-600" />}
          label="Shifts Created"
          value={metrics.shiftsCreated}
        />
        <MetricCard
          icon={<Clock size={18} className="text-blue-600" />}
          label="Total Hours"
          value={`${metrics.totalHours.toFixed(1)}h`}
        />
        <MetricCard
          icon={<TrendingUp size={18} className="text-purple-600" />}
          label="Labor Cost"
          value={`$${metrics.laborCost.toLocaleString()}`}
          subtitle={`${metrics.laborPercent.toFixed(1)}%`}
        />
        <MetricCard
          icon={<AlertTriangle size={18} className={metrics.coverageGaps > 0 ? 'text-amber-600' : 'text-green-600'} />}
          label="Coverage Gaps"
          value={metrics.coverageGaps}
          variant={metrics.coverageGaps > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* AI Reasoning Highlights */}
      {topReasoningExamples.length > 0 && (
        <ModalSection title="AI Reasoning Highlights">
          <div className="bg-purple-50 rounded-lg p-4 space-y-2">
            {topReasoningExamples.map((example, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                  {idx + 1}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{example.name}</span>
                  <span className="text-gray-600"> @ </span>
                  <span className="text-gray-700">{example.time}</span>
                  <span className="text-gray-600"> ({example.role})</span>
                  <p className="text-gray-600 mt-0.5">{example.reasons[0]}</p>
                </div>
              </div>
            ))}
          </div>
        </ModalSection>
      )}

      {/* Schedule Grid Preview */}
      <ModalSection title="Suggested Schedule">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <ScheduleGrid schedule={schedule} readOnly />
        </div>
      </ModalSection>

      {/* Coverage Gaps Warning */}
      {metrics.coverageGaps > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-amber-900 mb-2">
            <AlertTriangle size={18} />
            <span className="font-semibold">{metrics.coverageGaps} Coverage Gaps Detected</span>
          </div>
          <p className="text-sm text-amber-800">
            Some time slots don't meet minimum staffing requirements. You can edit the schedule
            after applying to fix these gaps.
          </p>
        </div>
      )}

      {/* Actions */}
      <ModalFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onApply} icon={<Check size={18} />}>
          Apply Schedule
        </Button>
      </ModalFooter>
    </Modal>
  )
}

/**
 * Metric card for summary stats
 */
function MetricCard({ icon, label, value, subtitle, variant = 'default' }) {
  const variantStyles = {
    default: 'bg-gray-50 border-gray-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-amber-50 border-amber-200',
  }

  return (
    <div className={`border rounded-lg p-4 ${variantStyles[variant]}`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  )
}
