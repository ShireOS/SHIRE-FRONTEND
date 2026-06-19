import { useState } from 'react'
import { Card, CardContent } from '../shared/Card'
import { Button } from '../shared/Button'
import { Badge } from '../shared/Badge'
import { Modal, ModalFooter } from '../shared/Modal'
import { Plus, Ban, Calendar } from 'lucide-react'

export function BlackoutsTab({ blackouts = [], onCreate, onCancel }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    scope: 'full_day',
    start_time: '',
    end_time: '',
    reason: '',
  })

  const sorted = [...blackouts].sort((a, b) => a.date.localeCompare(b.date))

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreate = () => {
    const payload = {
      date: form.start_date,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      scope: form.scope,
      start_time: form.scope === 'partial' ? form.start_time : null,
      end_time: form.scope === 'partial' ? form.end_time : null,
      reason: form.reason,
    }
    onCreate(payload)
    setIsModalOpen(false)
    setForm({ start_date: '', end_date: '', scope: 'full_day', start_time: '', end_time: '', reason: '' })
  }

  const handleCancel = (blackoutId) => {
    onCancel(blackoutId)
  }

  const formatDate = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateRange = (blackout) => {
    const startDate = blackout.start_date || blackout.date
    const endDate = blackout.end_date || blackout.start_date || blackout.date

    if (!startDate) return 'Unknown'
    if (!endDate || startDate === endDate) return formatDate(startDate)

    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dash-cream">Blackouts & Closures</h3>
        <Button icon={<Plus size={16} />} size="sm" onClick={() => setIsModalOpen(true)}>
          Add Blackout
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar size={32} className="mx-auto text-dash-tertiary mb-3" />
            <p className="text-dash-tertiary mb-4">No blackout dates configured.</p>
            <Button icon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>
              Add First Blackout
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dash-border">
                    <th className="px-6 py-3 label-mono text-left">DATE</th>
                    <th className="px-6 py-3 label-mono text-left">SCOPE</th>
                    <th className="px-6 py-3 label-mono text-left">TIME</th>
                    <th className="px-6 py-3 label-mono text-left">REASON</th>
                    <th className="px-6 py-3 label-mono text-left">STATUS</th>
                    <th className="px-6 py-3 label-mono text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {sorted.map((blackout) => (
                    <tr key={blackout.id} className="hover:bg-dash-cream/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-dash-cream font-medium">
                        {formatDateRange(blackout)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={blackout.scope === 'full_day' ? 'info' : 'warning'}>
                          {blackout.scope === 'full_day' ? 'Full Day' : 'Partial'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-dash-secondary">
                        {blackout.scope === 'partial' && blackout.start_time && blackout.end_time
                          ? `${blackout.start_time} - ${blackout.end_time}`
                          : 'All day'}
                      </td>
                      <td className="px-6 py-4 text-sm text-dash-secondary">
                        {blackout.reason}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={blackout.status === 'active' ? 'success' : 'neutral'} dot>
                          {blackout.status === 'active' ? 'active' : 'inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {blackout.status === 'active' && (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Ban size={14} />}
                            onClick={() => handleCancel(blackout.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Blackout Date">
        <div className="space-y-5">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-dash-secondary mb-1.5">Start Date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => handleFieldChange('start_date', e.target.value)}
              className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dash-secondary mb-1.5">End Date</label>
            <input
              type="date"
              value={form.end_date}
              min={form.start_date || undefined}
              onChange={(e) => handleFieldChange('end_date', e.target.value)}
              className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-dash-secondary mb-1.5">Scope</label>
            <div className="flex gap-3">
              <button
                onClick={() => handleFieldChange('scope', 'full_day')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.scope === 'full_day'
                    ? 'bg-dash-gold/15 text-dash-gold border-dash-gold/30'
                    : 'bg-dash-cream/5 text-dash-secondary border-dash-border hover:border-dash-gold/20'
                }`}
              >
                Full Day
              </button>
              <button
                onClick={() => handleFieldChange('scope', 'partial')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.scope === 'partial'
                    ? 'bg-dash-gold/15 text-dash-gold border-dash-gold/30'
                    : 'bg-dash-cream/5 text-dash-secondary border-dash-border hover:border-dash-gold/20'
                }`}
              >
                Partial Day
              </button>
            </div>
          </div>

          {/* Time Range (if partial) */}
          {form.scope === 'partial' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">Start Time</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => handleFieldChange('start_time', e.target.value)}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dash-secondary mb-1.5">End Time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => handleFieldChange('end_time', e.target.value)}
                  className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream focus:outline-none focus:border-dash-gold/50"
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-dash-secondary mb-1.5">Reason</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => handleFieldChange('reason', e.target.value)}
              className="w-full px-3 py-2 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream placeholder-dash-tertiary focus:outline-none focus:border-dash-gold/50"
              placeholder="e.g. Christmas Day - Closed"
            />
          </div>

          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!form.start_date || !form.reason || (form.scope === 'partial' && (!form.start_time || !form.end_time))}
            >
              Create Blackout
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}
