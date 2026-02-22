import { useState } from 'react'
import { Modal, ModalFooter, ModalSection } from '../shared/Modal'
import { Button } from '../shared/Button'
import { Sparkles, AlertTriangle, Trash2 } from 'lucide-react'
import { scheduleApi } from '../../../shared/api/scheduleApi'

/**
 * Modal for editing an existing shift
 * Shows AI reasoning (if applicable) and allows editing times, staff assignment, and role
 */
export function EditShiftModal({ shift, staffRow, allStaff, onSave, onClose }) {
  const [formData, setFormData] = useState({
    waiter_id: staffRow.waiterId,
    shift_start: shift.startTime,
    shift_end: shift.endTime,
    role: shift.role,
  })

  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await scheduleApi.updateItem(shift.itemId, formData)
      onSave() // Trigger refetch
    } catch (err) {
      console.error('[EditShiftModal] Failed to update shift:', err)
      alert('Failed to update shift. Check console for details.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${staffRow.name}'s ${shift.displayTime} shift?`)) {
      return
    }

    setIsDeleting(true)
    try {
      await scheduleApi.deleteItem(shift.itemId)
      onSave() // Trigger refetch
      onClose()
    } catch (err) {
      console.error('[EditShiftModal] Failed to delete shift:', err)
      alert('Failed to delete shift. Check console for details.')
    } finally {
      setIsDeleting(false)
    }
  }

  const hasReasoning = shift.reasoning && shift.reasoning.reasons.length > 0
  const hasViolations = shift.reasoning && shift.reasoning.constraint_violations.length > 0

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Shift" size="md">
      {/* AI Reasoning Section */}
      {hasReasoning && (
        <ModalSection title="AI Reasoning">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-900 mb-3">
              <Sparkles size={16} />
              <span className="font-semibold">Why AI scheduled this shift:</span>
            </div>
            <ul className="space-y-2">
              {shift.reasoning.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-dash-secondary">
                  <span className="text-green-600 flex-shrink-0">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>

            {hasViolations && (
              <>
                <div className="flex items-center gap-2 text-amber-900 mt-4 mb-2">
                  <AlertTriangle size={16} />
                  <span className="font-semibold">Warnings:</span>
                </div>
                <ul className="space-y-2">
                  {shift.reasoning.constraint_violations.map((violation, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="text-amber-600 flex-shrink-0">⚠</span>
                      <span>{violation}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-3 pt-3 border-t border-purple-200 text-sm text-gray-600">
              Confidence: {Math.round(shift.reasoning.confidence_score * 100)}%
            </div>
          </div>
        </ModalSection>
      )}

      {/* Edit Form */}
      <ModalSection title="Shift Details">
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
            >
              {allStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
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
                onChange={(e) => setFormData({ ...formData, shift_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dash-secondary mb-1">
                End Time
              </label>
              <input
                type="time"
                value={formData.shift_end}
                onChange={(e) => setFormData({ ...formData, shift_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <Button
          variant="danger"
          icon={<Trash2 size={18} />}
          onClick={handleDelete}
          disabled={isDeleting || isSaving}
        >
          {isDeleting ? 'Deleting...' : 'Delete Shift'}
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={onClose} disabled={isDeleting || isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isDeleting || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
