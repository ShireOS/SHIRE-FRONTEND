import { Card, CardContent } from '../shared/Card'
import { Badge } from '../shared/Badge'
import { schedule } from '../../data/mockData'

const dayTypeStyles = {
  slow: 'text-gray-500 bg-gray-100',
  avg: 'text-blue-600 bg-blue-100',
  busy: 'text-orange-600 bg-orange-100'
}

export function ScheduleGrid() {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                Staff
              </th>
              {schedule.days.map((day, idx) => (
                <th key={day} className="text-center py-4 px-2 min-w-[100px]">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{day}</div>
                  <Badge
                    variant={schedule.dayTypes[idx] === 'slow' ? 'neutral' : schedule.dayTypes[idx] === 'avg' ? 'info' : 'warning'}
                    className="text-[10px] px-2 py-0.5"
                  >
                    {schedule.dayTypes[idx].charAt(0).toUpperCase() + schedule.dayTypes[idx].slice(1)}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {schedule.staff.map((staffMember) => (
              <tr key={staffMember.name} className="hover:bg-gray-50 transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {staffMember.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{staffMember.name}</span>
                  </div>
                </td>
                {staffMember.shifts.map((shift, idx) => (
                  <td key={idx} className="py-4 px-2 text-center">
                    {shift === 'OFF' ? (
                      <span className="text-xs text-gray-400">OFF</span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <span className={`
                          inline-block px-3 py-1.5 rounded-lg text-sm font-medium
                          ${schedule.dayTypes[idx] === 'busy' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}
                        `}>
                          {shift}
                        </span>
                        {staffMember.isTraining?.[idx] && (
                          <span className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-white text-[10px]">T</span>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
