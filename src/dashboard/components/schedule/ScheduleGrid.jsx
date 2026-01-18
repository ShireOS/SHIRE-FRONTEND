import { Card, CardContent } from '../shared/Card'
import { Badge } from '../shared/Badge'
import { ShiftBadge } from './ShiftBadge'

const dayTypeStyles = {
  slow: 'text-gray-500 bg-gray-100',
  avg: 'text-blue-600 bg-blue-100',
  busy: 'text-orange-600 bg-orange-100',
}

/**
 * Get cell background style based on availability status
 */
function getAvailabilityStyle(status) {
  switch (status) {
    case 'preferred':
      return 'bg-green-50 hover:bg-green-100'
    case 'unavailable':
      return 'bg-gray-100 cursor-not-allowed'
    default:
      return 'hover:bg-gray-50 cursor-pointer'
  }
}

export function ScheduleGrid({ schedule, onShiftClick, onCellClick, readOnly = false }) {
  if (!schedule) return null

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                Staff
              </th>
              {schedule.days.map((day, idx) => (
                <th key={day} className="text-center py-4 px-2 min-w-[120px]">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    {day}
                  </div>
                  <Badge
                    variant={
                      schedule.dayTypes[idx] === 'slow'
                        ? 'neutral'
                        : schedule.dayTypes[idx] === 'avg'
                        ? 'info'
                        : 'warning'
                    }
                    className="text-[10px] px-2 py-0.5"
                  >
                    {schedule.dayTypes[idx].charAt(0).toUpperCase() +
                      schedule.dayTypes[idx].slice(1)}
                  </Badge>
                </th>
              ))}
              <th className="text-center py-4 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {schedule.staff.map((staffRow) => (
              <tr key={staffRow.waiterId} className="transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {staffRow.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900 block">
                        {staffRow.name}
                      </span>
                      <span className="text-xs text-gray-500">{staffRow.role}</span>
                    </div>
                  </div>
                </td>
                {staffRow.shifts.map((shift, dayIdx) => {
                  const availability = staffRow.availability[dayIdx]
                  const cellStyle = getAvailabilityStyle(availability)
                  const isClickable = !readOnly && availability !== 'unavailable'

                  return (
                    <td
                      key={dayIdx}
                      className={`py-4 px-2 text-center transition-colors ${cellStyle}`}
                      onClick={() => {
                        if (isClickable && !shift && onCellClick) {
                          onCellClick(staffRow, dayIdx)
                        }
                      }}
                    >
                      {shift ? (
                        <ShiftBadge
                          shift={shift}
                          dayType={schedule.dayTypes[dayIdx]}
                          onClick={(e) => {
                            if (!readOnly && onShiftClick) {
                              e.stopPropagation()
                              onShiftClick(shift, staffRow)
                            }
                          }}
                        />
                      ) : (
                        <span
                          className={`text-xs ${
                            availability === 'unavailable'
                              ? 'text-gray-400'
                              : 'text-gray-300 hover:text-gray-500'
                          }`}
                        >
                          {availability === 'unavailable' ? 'N/A' : isClickable ? '+' : '--'}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="py-4 px-2 text-center">
                  <span className="text-sm font-semibold text-gray-700">
                    {staffRow.totalHours.toFixed(1)}h
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
