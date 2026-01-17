import { useParams } from 'react-router-dom'
import { StaffTable } from '../components/staff/StaffTable'
import { StaffProfile } from '../components/staff/StaffProfile'
import { Button } from '../components/shared/Button'
import { UserPlus, Calendar } from 'lucide-react'

export function Staff() {
  const { id } = useParams()

  // If we have an ID, show the profile
  if (id) {
    return <StaffProfile />
  }

  // Otherwise, show the table
  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-600 mt-1">Manage your team and track performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={<Calendar size={18} />}>
            View Schedule
          </Button>
          <Button icon={<UserPlus size={18} />}>
            Add Staff
          </Button>
        </div>
      </div>

      {/* Staff Table */}
      <StaffTable />
    </div>
  )
}
