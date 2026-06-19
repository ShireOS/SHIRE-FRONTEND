import { useState } from 'react'
import { Card, CardContent } from '../shared/Card'
import { Button } from '../shared/Button'
import { Plus, Trash2, Utensils, Phone, Globe, Smartphone } from 'lucide-react'

const CHANNEL_META = {
  host: { icon: Utensils, label: 'Host / Walk-in' },
  phone: { icon: Phone, label: 'Phone' },
  web: { icon: Globe, label: 'Website' },
  app: { icon: Smartphone, label: 'Mobile App' },
}

export function BookingRulesTab({ pacingRules = [], channelRules = [], onSave }) {
  const [localPacing, setLocalPacing] = useState(pacingRules)
  const [localChannels, setLocalChannels] = useState(channelRules)
  const [dirty, setDirty] = useState(false)

  const handlePacingChange = (index, field, value) => {
    const updated = localPacing.map((rule, i) =>
      i === index ? { ...rule, [field]: Number(value) } : rule
    )
    setLocalPacing(updated)
    setDirty(true)
  }

  const handleAddPacing = () => {
    setLocalPacing([
      ...localPacing,
      { id: `pr-${Date.now()}`, window_minutes: 15, max_covers_per_window: 10 },
    ])
    setDirty(true)
  }

  const handleRemovePacing = (index) => {
    setLocalPacing(localPacing.filter((_, i) => i !== index))
    setDirty(true)
  }

  const handleChannelToggle = (channel) => {
    const updated = localChannels.map((rule) =>
      rule.channel === channel ? { ...rule, is_enabled: !rule.is_enabled } : rule
    )
    setLocalChannels(updated)
    setDirty(true)
  }

  const handleSave = () => {
    onSave({ pacing_rules: localPacing, channel_rules: localChannels })
    setDirty(false)
  }

  return (
    <div className="space-y-6">
      {/* Pacing Rules */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-dash-cream">Pacing Rules</h3>
              <p className="text-sm text-dash-tertiary mt-0.5">Control how many covers are accepted per time window</p>
            </div>
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={handleAddPacing}>
              Add Rule
            </Button>
          </div>

          {localPacing.length === 0 ? (
            <p className="text-dash-tertiary text-sm py-4 text-center">No pacing rules configured. Add one to limit booking density.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dash-border">
                    <th className="pb-3 label-mono text-left">TIME WINDOW</th>
                    <th className="pb-3 label-mono text-left">MAX COVERS</th>
                    <th className="pb-3 label-mono text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {localPacing.map((rule, index) => (
                    <tr key={rule.id} className="hover:bg-dash-cream/5 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            step={5}
                            value={rule.window_minutes}
                            onChange={(e) => handlePacingChange(index, 'window_minutes', e.target.value)}
                            className="w-20 px-2 py-1.5 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream text-sm focus:outline-none focus:border-dash-gold/50"
                          />
                          <span className="text-sm text-dash-tertiary">minutes</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={rule.max_covers_per_window}
                            onChange={(e) => handlePacingChange(index, 'max_covers_per_window', e.target.value)}
                            className="w-20 px-2 py-1.5 bg-dash-cream/5 border border-dash-border rounded-lg text-dash-cream text-sm focus:outline-none focus:border-dash-gold/50"
                          />
                          <span className="text-sm text-dash-tertiary">covers</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          onClick={() => handleRemovePacing(index)}
                          className="text-dash-danger hover:text-dash-danger"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Rules */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-dash-cream">Booking Channels</h3>
            <p className="text-sm text-dash-tertiary mt-0.5">Enable or disable reservation sources</p>
          </div>

          <div className="space-y-3">
            {localChannels.map((rule) => {
              const meta = CHANNEL_META[rule.channel]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <div
                  key={rule.channel}
                  className="flex items-center justify-between py-3 px-4 border border-dash-border rounded-lg hover:border-dash-gold/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-dash-cream/5 border border-dash-border flex items-center justify-center">
                      <Icon size={16} className="text-dash-secondary" />
                    </div>
                    <span className="text-sm font-medium text-dash-cream">{meta.label}</span>
                  </div>
                  <button
                    onClick={() => handleChannelToggle(rule.channel)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      rule.is_enabled ? 'bg-dash-gold' : 'bg-dash-cream/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        rule.is_enabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {dirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      )}
    </div>
  )
}
