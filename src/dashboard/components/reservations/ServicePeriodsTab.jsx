import { useState } from 'react'
import { Card, CardContent } from '../shared/Card'
import { Button } from '../shared/Button'
import { Badge } from '../shared/Badge'
import { Modal, ModalFooter } from '../shared/Modal'
import { Plus, Edit2, Clock, Users as UsersIcon } from 'lucide-react'

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = { monday: 'M', tuesday: 'T', wednesday: 'W', thursday: 'Th', friday: 'F', saturday: 'S', sunday: 'Su' }

const INTERVAL_OPTIONS = [15, 30, 45, 60]

const blankPeriod = {
  id: '',
  name: '',
  days_of_week: [],
  start_time: '17:00',
  end_time: '22:00',
  slot_interval_minutes: 30,
  lead_time_hours: 4,
  cutoff_time: '21:30',
  min_party_size: 1,
  max_party_size: 10,
  is_active: true,
}

export function ServicePeriodsTab({ servicePeriods = [], onSave }) {
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleEdit = (period) => {
    setEditingPeriod({ ...period })
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setEditingPeriod({ ...blankPeriod, id: `sp-${Date.now()}` })
    setIsModalOpen(true)
  }

  const handleClose = () => {
    setIsModalOpen(false)
    setEditingPeriod(null)
  }

  const handleFieldChange = (field, value) => {
    setEditingPeriod((prev) => ({ ...prev, [field]: value }))
  }

  const handleDayToggle = (day) => {
    setEditingPeriod((prev) => {
      const days = prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day]
      return { ...prev, days_of_week: days }
    })
  }

  const handleSave = () => {
    const exists = servicePeriods.find((sp) => sp.id === editingPeriod.id)
    const updated = exists
      ? servicePeriods.map((sp) => (sp.id === editingPeriod.id ? editingPeriod : sp))
      : [...servicePeriods, editingPeriod]
    onSave(updated)
    handleClose()
  }

  const handleDelete = (periodId) => {
    onSave(servicePeriods.filter((sp) => sp.id !== periodId))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dash-cream">Service Periods</h3>
        <Button icon={<Plus size={16} />} size="sm" onClick={handleAdd}>
          Add Period
        </Button>
      </div>

      {servicePeriods.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-dash-tertiary mb-4">No service periods configured yet.</p>
            <Button icon={<Plus size={16} />} onClick={handleAdd}>
              Create First Period
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {servicePeriods.map((period) => (
          <Card key={period.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-dash-cream">{period.name}</h4>
                  <Badge variant={period.is_active ? 'success' : 'neutral'} dot>
                    {period.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => handleEdit(period)}>
                  Edit
                </Button>
              </div>

              {/* Day pills */}
              <div className="flex gap-1.5 mb-3">
                {ALL_DAYS.map((day) => (
                  <span
                    key={day}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      period.days_of_week.includes(day)
                        ? 'bg-dash-gold/20 text-dash-gold border border-dash-gold/30'
                        : 'bg-dash-cream/5 text-dash-tertiary border border-dash-border'
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </span>
                ))}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-dash-secondary">
                  <Clock size={14} className="text-dash-tertiary" />
                  {period.start_time} - {period.end_time}
                </div>
                <div className="flex items-center gap-2 text-dash-secondary">
                  <UsersIcon size={14} className="text-dash-tertiary" />
                  {period.min_party_size}-{period.max_party_size} guests
                </div>
                <div className="text-dash-tertiary">
                  Every {period.slot_interval_minutes}min
                </div>
                <div className="text-dash-tertiary">
                  {period.lead_time_hours}h lead time
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Create Modal */}
      <Modal isOpen={isModalOpen} onClose={handleClose} title={editingPeriod?.name ? `Edit: ${editingPeriod.name}` : 'New Service Period'} size="md">
        {editingPeriod && (
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-dash-secondary mb-1.5">Period Name</label>
              <input
                type="text"
                value={editingPeriod.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream placeholder-dash-tertiary focus:outline-none focus:border-dash-gold/50"
                placeholder="e.g. Dinner"
              />
            </div>

            {/* Days */}
            <div>
              <label className="block text-sm font-medium text-dash-secondary mb-1.5">Days of Week</label>
              <div className="flex gap-2">
                {ALL_DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                      editingPeriod.days_of_week.includes(day)
                        ? 'bg-dash-gold/20 text-dash-gold border border-dash-gold/30'
                        : 'bg-dash-cream/5 text-dash-tertiary border border-dash-border hover:border-dash-gold/20'
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">Start Time</label>
                <input
                  type="time"
                  value={editingPeriod.start_time}
                  onChange={(e) => handleFieldChange('start_time', e.target.value)}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">End Time</label>
                <input
                  type="time"
                  value={editingPeriod.end_time}
                  onChange={(e) => handleFieldChange('end_time', e.target.value)}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
            </div>

            {/* Interval & Lead Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">Slot Interval</label>
                <select
                  value={editingPeriod.slot_interval_minutes}
                  onChange={(e) => handleFieldChange('slot_interval_minutes', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                >
                  {INTERVAL_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m} minutes</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">Lead Time (hours)</label>
                <input
                  type="number"
                  min={0}
                  value={editingPeriod.lead_time_hours}
                  onChange={(e) => handleFieldChange('lead_time_hours', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
            </div>

            {/* Party Sizes & Cutoff */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">Min Party</label>
                <input
                  type="number"
                  min={1}
                  value={editingPeriod.min_party_size}
                  onChange={(e) => handleFieldChange('min_party_size', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">Max Party</label>
                <input
                  type="number"
                  min={1}
                  value={editingPeriod.max_party_size}
                  onChange={(e) => handleFieldChange('max_party_size', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">Cutoff Time</label>
                <input
                  type="time"
                  value={editingPeriod.cutoff_time || ''}
                  onChange={(e) => handleFieldChange('cutoff_time', e.target.value || null)}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-dash-secondary">Active</span>
              <button
                onClick={() => handleFieldChange('is_active', !editingPeriod.is_active)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  editingPeriod.is_active ? 'bg-dash-gold' : 'bg-dash-cream/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    editingPeriod.is_active ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <ModalFooter>
              {/* Delete button (only for existing periods) */}
              {servicePeriods.find((sp) => sp.id === editingPeriod.id) && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    handleDelete(editingPeriod.id)
                    handleClose()
                  }}
                  className="mr-auto"
                >
                  Delete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!editingPeriod.name || editingPeriod.days_of_week.length === 0}>
                Save
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  )
}
