import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid'
import { AISchedulePreviewModal } from '../components/schedule/AISchedulePreviewModal'
import { EditShiftModal } from '../components/schedule/EditShiftModal'
import { AddShiftModal } from '../components/schedule/AddShiftModal'
import { Sparkles, ChevronLeft, ChevronRight, Send, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import { useStaffingRequirements, useAllStaffAvailability, useCoverageGaps } from '../../shared/hooks/useSchedule'
import { useSchedulingEngine } from '../../shared/hooks/useSchedulingEngine'
import { useWaiterList } from '../../shared/hooks/useWaiterList'
import { useRestaurants } from '../../shared/hooks/useMenuAnalytics'
import { scheduleApi } from '../../shared/api/scheduleApi'
import { detectCoverageGaps, transformSchedule } from '../../shared/utils/dataTransformers'
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
  // Restaurant selection (auto-select first restaurant, which is Mimosas)
  const [restaurantId, setRestaurantId] = useState(null)
  const { data: restaurants, loading: loadingRestaurants } = useRestaurants()

  useEffect(() => {
    if (restaurants && restaurants.length > 0) {
      // LOG ALL AVAILABLE RESTAURANTS
      console.group('[Schedule] 🏢 Available Restaurants')
      console.log('Total Restaurants:', restaurants.length)
      console.table(restaurants.map(r => ({
        id: r.id,
        name: r.name,
      })))
      console.groupEnd()

      // SELECT FIRST RESTAURANT (Mimosas)
      const selectedRestaurant = restaurants[0]
      console.log('[Schedule] 🎯 Auto-selecting FIRST restaurant:', selectedRestaurant.name, selectedRestaurant.id)
      setRestaurantId(selectedRestaurant.id)
    }
  }, [restaurants])

  // Week navigation
  const [currentWeek, setCurrentWeek] = useState(getWeekStart())

  const handlePrevWeek = () => {
    setCurrentWeek((prev) => addWeeks(prev, -1))
    setSchedule(null) // Clear schedule when changing weeks
  }

  const handleNextWeek = () => {
    setCurrentWeek((prev) => addWeeks(prev, 1))
    setSchedule(null) // Clear schedule when changing weeks
  }

  // Fetch schedule for current week when week changes (but not on mount)
  useEffect(() => {
    // Only fetch if we already have a schedule (user has used AI or navigated)
    if (schedule !== null && staff && allAvailability) {
      refetchSchedule()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek])

  // Fetch staff list
  const { data: staff, loading: loadingStaff, error: staffError } = useWaiterList(restaurantId)

  // Fetch staff availability
  const { data: allAvailability } = useAllStaffAvailability(staff || [])

  // DON'T auto-fetch schedule - start empty, only load after AI generation
  const [schedule, setSchedule] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // Manual refetch function (called after AI apply or week navigation)
  const refetchSchedule = async () => {
    if (!restaurantId || !currentWeek || !staff || !allAvailability) return

    setLoadingSchedule(true)
    try {
      const schedules = await scheduleApi.getSchedules(restaurantId, currentWeek)
      if (schedules.length > 0) {
        const transformed = transformSchedule(schedules[0], staff, allAvailability)
        if (transformed && requirements) {
          transformed.coverageGaps = detectCoverageGaps(transformed, requirements)
        }
        setSchedule(transformed)
      } else {
        setSchedule(null)
      }
    } catch (err) {
      console.error('[Schedule] Error fetching schedule:', err)
      setSchedule(null)
    } finally {
      setLoadingSchedule(false)
    }
  }

  // Fetch staffing requirements
  const { data: requirements } = useStaffingRequirements(restaurantId)

  // ENHANCED LOGGING - Track staff available for scheduling (AFTER all data is declared)
  useEffect(() => {
    if (staff && staff.length > 0 && restaurantId) {
      const mimosas = restaurants?.find((r) => r.id === restaurantId)
      console.group('[Schedule] 📅 Staff Available for Scheduling')
      console.log('Restaurant:', mimosas?.name || restaurantId)
      console.log('Week:', currentWeek)
      console.log('🔢 Total Staff Count:', staff.length)
      console.log('Staff Sample (first 5):', staff.slice(0, 5).map(s => ({
        id: s.id.slice(0, 8),
        name: s.name,
        role: s.role,
        tenure: s.tenure,
      })))
      console.log('Availability Data Loaded:', allAvailability ? `${allAvailability.length} records` : 'None')
      console.log('Requirements Loaded:', requirements ? `${requirements.length} slots` : 'None')
      console.groupEnd()
    }
  }, [staff, restaurantId, restaurants, currentWeek, allAvailability, requirements])

  // Calculate coverage gaps
  const coverageGaps = useMemo(() => {
    if (!schedule || !requirements) return []
    return detectCoverageGaps(schedule, requirements)
  }, [schedule, requirements])

  // AI scheduling engine
  const { runScheduler, isRunning: isGenerating } = useSchedulingEngine()
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [suggestedSchedule, setSuggestedSchedule] = useState(null)

  // Shift editing state
  const [editingShift, setEditingShift] = useState(null)
  const [editingStaffRow, setEditingStaffRow] = useState(null)
  const [showAddShift, setShowAddShift] = useState(false)
  const [addShiftPreselect, setAddShiftPreselect] = useState({ staffId: null, date: null })

  const handleAISuggest = async () => {
    try {
      // If a draft schedule exists for this week, delete it first
      if (schedule && schedule.status === 'draft') {
        console.log('[Schedule] Deleting existing draft schedule before generating new one')
        try {
          await scheduleApi.deleteSchedule(schedule.id)
        } catch (deleteErr) {
          console.warn('[Schedule] Could not delete draft (may not have DELETE endpoint yet):', deleteErr)
        }
      }

      const result = await runScheduler(restaurantId, currentWeek)

      if (result.schedule_id) {
        // Fetch the generated schedule with items and reasoning
        console.log('[Schedule] Fetching generated schedule:', result.schedule_id)
        const newSchedule = await scheduleApi.getScheduleById(result.schedule_id)

        console.log('[Schedule] Staff count for transform:', staff?.length || 0)
        console.log('[Schedule] Schedule has items:', newSchedule.items?.length || 0)

        // Transform to frontend format
        const transformed = transformSchedule(newSchedule, staff || [], allAvailability || [])

        // Add coverage gaps
        if (transformed && requirements) {
          transformed.coverageGaps = detectCoverageGaps(transformed, requirements)
        }

        setSuggestedSchedule(transformed)
        setShowPreviewModal(true)  // Show preview modal
      }
    } catch (err) {
      console.error('[Schedule] AI generation failed:', err)

      let message = 'Failed to generate AI schedule.'
      if (err?.status === 409) {
        message = 'A schedule already exists for this week. Backend needs to handle duplicate schedules - see docs/BACKEND_SCHEDULING_ISSUES.md'
      } else if (err?.status === 422) {
        message = 'Invalid request. Check that all staff have availability configured.'
      }

      alert(message)
    }
  }

  const handleApplySchedule = async () => {
    // User approved the AI schedule - it's already in the DB, just close modal and refresh
    setShowPreviewModal(false)
    setSuggestedSchedule(null)
    await refetchSchedule()  // This will now show the schedule in the main grid
  }

  const handleCancelSuggestion = async () => {
    // User rejected the AI schedule - delete it from DB
    if (suggestedSchedule) {
      try {
        await scheduleApi.deleteSchedule(suggestedSchedule.id)
      } catch (err) {
        console.warn('[Schedule] Could not delete suggestion:', err)
      }
    }
    setShowPreviewModal(false)
    setSuggestedSchedule(null)
  }

  // Shift editing handlers
  const handleShiftClick = (shift, staffRow) => {
    setEditingShift(shift)
    setEditingStaffRow(staffRow)
  }

  const handleCellClick = (staffRow, dayIdx) => {
    // Calculate the date for this day
    const dayDate = new Date(schedule.weekStartDate)
    dayDate.setDate(dayDate.getDate() + dayIdx)
    const dateStr = dayDate.toISOString().split('T')[0]

    setAddShiftPreselect({ staffId: staffRow.waiterId, date: dateStr })
    setShowAddShift(true)
  }

  const handleShiftSaved = async () => {
    setEditingShift(null)
    setEditingStaffRow(null)
    setShowAddShift(false)
    await refetchSchedule()
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

  // Loading state (only for initial page load)
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

  // Error state (only show for critical staff errors)
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
          <Button
            variant="outline"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => setShowAddShift(true)}
          >
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
        <ScheduleGrid
          schedule={schedule}
          onShiftClick={handleShiftClick}
          onCellClick={handleCellClick}
        />
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

      {/* AI Preview Modal */}
      {showPreviewModal && suggestedSchedule && (
        <AISchedulePreviewModal
          schedule={suggestedSchedule}
          onApply={handleApplySchedule}
          onCancel={handleCancelSuggestion}
        />
      )}

      {/* Edit Shift Modal */}
      {editingShift && editingStaffRow && (
        <EditShiftModal
          shift={editingShift}
          staffRow={editingStaffRow}
          allStaff={staff || []}
          onSave={handleShiftSaved}
          onClose={() => {
            setEditingShift(null)
            setEditingStaffRow(null)
          }}
        />
      )}

      {/* Add Shift Modal */}
      {showAddShift && schedule && (
        <AddShiftModal
          scheduleId={schedule.id}
          allStaff={staff || []}
          preselectedStaffId={addShiftPreselect.staffId}
          preselectedDate={addShiftPreselect.date}
          onSave={handleShiftSaved}
          onClose={() => setShowAddShift(false)}
        />
      )}
    </div>
  )
}
