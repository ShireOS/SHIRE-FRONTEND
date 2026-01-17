import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid'
import { Sparkles, ChevronLeft, ChevronRight, Send, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import { useSchedule, useStaffingRequirements, useAllStaffAvailability, useCoverageGaps } from '../../shared/hooks/useSchedule'
import { useSchedulingEngine } from '../../shared/hooks/useSchedulingEngine'
import { useWaiterList } from '../../shared/hooks/useWaiterList'
import { useRestaurants } from '../../shared/hooks/useMenuAnalytics'
import { scheduleApi } from '../../shared/api/scheduleApi'
import { detectCoverageGaps } from '../../shared/utils/dataTransformers'
import { API_CONFIG } from '../../shared/api/config'

/**
 * Get Monday of current week in YYYY-MM-DD format
 */
function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

/**
 * Add weeks to a date string
 */
function addWeeks(dateStr, weeks) {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + weeks * 7)
  return date.toISOString().split('T')[0]
}

export function Schedule() {
  // Restaurant selection (auto-select Mimosas)
  const [restaurantId, setRestaurantId] = useState(null)
  const { data: restaurants, loading: loadingRestaurants } = useRestaurants()

  useEffect(() => {
    if (restaurants && restaurants.length > 0) {
      const mimosas = restaurants.find((r) => r.name === 'Mimosas')
      if (mimosas) {
        console.log('[Schedule] Auto-selecting Mimosas restaurant:', mimosas.id)
        setRestaurantId(mimosas.id)
      } else {
        // Fallback to first restaurant
        console.log('[Schedule] Mimosas not found, using first restaurant:', restaurants[0].id)
        setRestaurantId(restaurants[0].id)
      }
    }
  }, [restaurants])

  // Week navigation
  const [currentWeek, setCurrentWeek] = useState(getWeekStart())

  const handlePrevWeek = () => setCurrentWeek((prev) => addWeeks(prev, -1))
  const handleNextWeek = () => setCurrentWeek((prev) => addWeeks(prev, 1))

  // Fetch staff list
  const { data: staff, loading: loadingStaff, error: staffError } = useWaiterList(restaurantId)

  // Fetch staff availability
  const { data: allAvailability } = useAllStaffAvailability(staff || [])

  // Fetch schedule data
  const {
    data: schedule,
    loading: loadingSchedule,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useSchedule(restaurantId, currentWeek, staff || [], allAvailability || [])

  // Fetch staffing requirements
  const { data: requirements } = useStaffingRequirements(restaurantId)

  // Calculate coverage gaps
  const coverageGaps = useMemo(() => {
    if (!schedule || !requirements) return []
    return detectCoverageGaps(schedule, requirements)
  }, [schedule, requirements])

  // AI scheduling engine
  const { runScheduler, isRunning: isGenerating } = useSchedulingEngine()
  const [showingAISuggestion, setShowingAISuggestion] = useState(false)

  const handleAISuggest = async () => {
    try {
      setShowingAISuggestion(true)

      // If a draft schedule exists for this week, delete it first
      if (schedule && schedule.status === 'draft') {
        console.log('[Schedule] Deleting existing draft schedule before generating new one')
        try {
          await scheduleApi.deleteSchedule(schedule.id)
        } catch (deleteErr) {
          console.warn('[Schedule] Could not delete draft (may not have DELETE endpoint yet):', deleteErr)
          // Continue anyway - backend might handle it
        }
      }

      const result = await runScheduler(restaurantId, currentWeek)

      if (result.schedule_id) {
        // Refresh schedule to show new AI-generated schedule
        await refetchSchedule()
        alert(
          `AI schedule generated! ` +
            `Created ${result.summary_metrics?.items_created || 0} shifts with ` +
            `${result.summary_metrics?.coverage_pct?.toFixed(1) || 0}% coverage.`
        )
      }
    } catch (err) {
      console.error('[Schedule] AI generation failed:', err)

      // Show helpful error message based on error type
      let message = 'Failed to generate AI schedule.'
      if (err?.status === 409) {
        message = 'A schedule already exists for this week. Backend needs to handle duplicate schedules - see docs/BACKEND_SCHEDULING_ISSUES.md'
      } else if (err?.status === 422) {
        message = 'Invalid request. Check that all staff have availability configured.'
      }

      alert(message)
    } finally {
      setShowingAISuggestion(false)
    }
  }

  // Publish schedule
  const handlePublish = async () => {
    if (!schedule) {
      alert('No schedule to publish')
      return
    }

    if (!confirm('Publish this schedule? Staff will be notified.')) {
      return
    }

    try {
      await scheduleApi.publishSchedule(schedule.id)
      await refetchSchedule()
      alert('Schedule published successfully!')
    } catch (err) {
      console.error('[Schedule] Publish failed:', err)
      alert('Failed to publish schedule. Check console for details.')
    }
  }

  // Loading state
  const loading = loadingRestaurants || !restaurantId || loadingStaff
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="animate-spin" size={20} />
          <span>
            {loadingRestaurants
              ? 'Loading restaurants...'
              : !restaurantId
              ? 'Selecting restaurant...'
              : 'Loading staff...'}
          </span>
        </div>
      </div>
    )
  }

  // Error state (only show for critical errors, not missing schedules)
  if (staffError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500 text-center">
          <p className="font-semibold">Error loading staff data</p>
          <p className="text-sm mt-1">{staffError?.message || 'Unknown error'}</p>
          <p className="text-xs mt-2 text-gray-500">
            Check that backend is running at {API_CONFIG.baseUrl}
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-600 mt-1">
            Plan and manage your team's shifts
            {restaurants && (
              <span className="text-sm text-purple-600 ml-2">
                · {restaurants.find((r) => r.id === restaurantId)?.name || 'Loading...'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={<Sparkles size={18} />}
            onClick={handleAISuggest}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'AI Suggest'}
          </Button>
          <Button
            icon={<Send size={18} />}
            onClick={handlePublish}
            disabled={!schedule || schedule.status === 'published'}
          >
            {schedule?.status === 'published' ? 'Published' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronLeft size={18} />}
            onClick={handlePrevWeek}
          />
          <span className="text-lg font-semibold text-gray-900">
            Week of {schedule?.weekOf || currentWeek}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronRight size={18} />}
            onClick={handleNextWeek}
          />
        </div>
        <div className="flex items-center gap-2">
          {schedule && (
            <Badge variant={schedule.status === 'published' ? 'success' : 'info'}>
              {schedule.status.toUpperCase()}
            </Badge>
          )}
          <Button variant="outline" size="sm" icon={<Plus size={16} />}>
            Add Shift
          </Button>
        </div>
      </div>

      {/* Coverage Gap Warnings */}
      {coverageGaps.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">Coverage Gaps Detected</h3>
                <div className="space-y-1">
                  {coverageGaps.slice(0, 3).map((gap, idx) => (
                    <p key={idx} className="text-sm text-amber-800">
                      {gap.day} {gap.timeSlot}: Need {gap.shortage} more {gap.role}
                      {gap.shortage > 1 ? 's' : ''}
                    </p>
                  ))}
                  {coverageGaps.length > 3 && (
                    <p className="text-sm text-amber-700 font-medium">
                      + {coverageGaps.length - 3} more gaps
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Grid */}
      {schedule ? (
        <ScheduleGrid schedule={schedule} />
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Sparkles size={48} className="mx-auto" />
            </div>
            <p className="text-gray-600 mb-4">No schedule for this week yet</p>
            <Button icon={<Sparkles size={18} />} onClick={handleAISuggest} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Legend & Summary */}
      {schedule && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
              <span>Preferred</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-gray-200 border border-gray-400 rounded"></span>
              <span>Unavailable</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="text-xs">
                Busy
              </Badge>
              <span>Expected high traffic</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Projected Labor Cost:</span>
              <span className="ml-2 font-semibold text-gray-900">
                ${schedule.laborCost.toLocaleString()}
              </span>
              <span className="ml-1 text-gray-500">
                ({schedule.laborPercent.toFixed(1)}%)
              </span>
            </div>
            <div>
              <span className="text-gray-500">Total Hours:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {schedule.totalHours.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
