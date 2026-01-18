import { Card, CardContent } from '../shared/Card'
import { Badge } from '../shared/Badge'
import { ShiftBadge } from './ShiftBadge'

const dayTypeStyles = {
  slow: 'text-dash-tertiary bg-white/5',
  avg: 'text-dash-secondary bg-white/10',
  busy: 'text-dash-warning bg-dash-warning/10',
}

/**
 * Get cell background style based on availability status
 */
function getAvailabilityStyle(status) {
  switch (status) {
    case 'preferred':
      return 'bg-dash-success/10 hover:bg-dash-success/20'
    case 'unavailable':
      return 'bg-white/5 cursor-not-allowed'
    default:
      return 'hover:bg-white/5 cursor-pointer'
  }
}

export function ScheduleGrid({ schedule, onShiftClick, onCellClick, readOnly = false }) {
  if (!schedule) return null

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-dash-border">
              <th className="text-left py-4 px-4 label-mono w-32">
                STAFF
              </th>
              {schedule.days.map((day, idx) => (
                <th key={day} className="text-center py-4 px-2 min-w-[120px]">
                  <div className="label-mono mb-1">
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
              <th className="text-center py-4 px-2 label-mono">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border">
            {schedule.staff.map((staffRow) => (
              <tr key={staffRow.waiterId} className="transition-colors hover:bg-white/5">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/10 border border-dash-border rounded-full flex items-center justify-center text-xs font-medium text-dash-cream">
                      {staffRow.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-dash-cream block">
                        {staffRow.name}
                      </span>
                      <span className="text-xs text-dash-tertiary">{staffRow.role}</span>
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
                              ? 'text-dash-tertiary'
                              : 'text-dash-tertiary/50 hover:text-dash-secondary'
                          }`}
                        >
                          {availability === 'unavailable' ? 'N/A' : isClickable ? '+' : '--'}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="py-4 px-2 text-center">
                  <span className="text-sm font-semibold text-dash-cream">
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
