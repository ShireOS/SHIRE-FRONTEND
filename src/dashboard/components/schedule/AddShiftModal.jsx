import { useState } from 'react'
import { Modal, ModalFooter, ModalSection } from '../shared/Modal'
import { Button } from '../shared/Button'
import { Plus } from 'lucide-react'
import { scheduleApi } from '../../../shared/api/scheduleApi'

/**
 * Modal for manually adding a new shift to the schedule
 */
export function AddShiftModal({
  scheduleId,
  allStaff,
  preselectedStaffId,
  preselectedDate,
  onSave,
  onClose,
}) {
  const [formData, setFormData] = useState({
    waiter_id: preselectedStaffId || (allStaff.length > 0 ? allStaff[0].id : ''),
    shift_date: preselectedDate || '',
    shift_start: '09:00:00',
    shift_end: '17:00:00',
    role: 'server',
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    setIsSaving(true)
    try {
      await scheduleApi.createItem(scheduleId, formData)
      onSave() // Trigger refetch
      onClose()
    } catch (err) {
      console.error('[AddShiftModal] Failed to create shift:', err)
      alert('Failed to create shift. Check console for details.')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedStaff = allStaff.find((s) => s.id === formData.waiter_id)

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Shift" size="md">
      <form onSubmit={handleSubmit}>
        <ModalSection>
          <div className="space-y-4">
            {/* Staff Selection */}
            <div>
              <label className="block text-sm font-medium text-dash-secondary mb-1">
                Staff Member
              </label>
              <select
                value={formData.waiter_id}
                onChange={(e) => setFormData({ ...formData, waiter_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {allStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
              {selectedStaff && (
                <p className="text-xs text-dash-tertiary mt-1">Role: {selectedStaff.role}</p>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-dash-secondary mb-1">Date</label>
              <input
                type="date"
                value={formData.shift_date}
                onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Time Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.shift_start}
                  onChange={(e) => setFormData({ ...formData, shift_start: e.target.value + ':00' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.shift_end}
                  onChange={(e) => setFormData({ ...formData, shift_end: e.target.value + ':00' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-dash-secondary mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="server">Server</option>
                <option value="bartender">Bartender</option>
                <option value="host">Host</option>
                <option value="chef">Chef</option>
                <option value="busser">Busser</option>
                <option value="runner">Runner</option>
              </select>
            </div>
          </div>
        </ModalSection>

        {/* Actions */}
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            icon={<Plus size={18} />}
            disabled={isSaving}
          >
            {isSaving ? 'Adding...' : 'Add Shift'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
