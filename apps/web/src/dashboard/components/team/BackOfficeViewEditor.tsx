import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Eye, Save } from 'lucide-react'
import {
  BACK_OFFICE_VIEW_CATALOG,
  VIEW_LEVELS,
  VIEW_MODES,
  defaultViewPolicy,
  normalizeViewPolicy,
  viewMode,
  type BackOfficeViewLevel,
  type BackOfficeViewMode,
  type BackOfficeViewPolicy,
  type ViewCapability,
} from '../../../shared/backOfficeView'

interface ViewTemplate {
  id: string
  name: string
  version: number
  policy: BackOfficeViewPolicy
}

interface Props {
  value: BackOfficeViewPolicy
  onChange: (value: BackOfficeViewPolicy) => void
  templates?: ViewTemplate[]
  onSaveTemplate?: (name: string, policy: BackOfficeViewPolicy) => Promise<void>
  disabled?: boolean
}

const modeTone: Record<BackOfficeViewMode, string> = {
  hidden: 'border-white/10 text-dash-tertiary',
  summary: 'border-sky-300/40 bg-sky-300/10 text-sky-200',
  standard: 'border-amber-300/40 bg-amber-300/10 text-amber-100',
  full: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100',
}

function CapabilityRow({ item, policy, onMode, disabled }: {
  item: ViewCapability
  policy: BackOfficeViewPolicy
  onMode: (id: string, mode: BackOfficeViewMode) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasChildren = Boolean(item.children?.length)
  const current = viewMode(policy, item.id)
  return (
    <div className="border-b border-dash-border last:border-0">
      <div className="flex flex-wrap items-center gap-3 px-3 py-3">
        <button
          type="button"
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
          disabled={!hasChildren}
          onClick={() => setOpen(value => !value)}
          className="grid h-8 w-8 place-items-center rounded-lg text-dash-tertiary disabled:opacity-20"
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <span className="min-w-[180px] flex-1 text-sm font-semibold text-dash-cream">{item.label}</span>
        <div className="flex flex-wrap gap-1">
          {VIEW_MODES.map(mode => (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => onMode(item.id, mode.id)}
              className={`min-h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition ${current === mode.id ? modeTone[mode.id] : 'border-dash-border text-dash-tertiary hover:text-dash-secondary'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      {open && hasChildren ? (
        <div className="ml-8 border-l border-dash-border bg-black/10">
          {item.children!.map(child => (
            <CapabilityRow key={child.id} item={child} policy={policy} onMode={onMode} disabled={disabled} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function BackOfficeViewEditor({ value, onChange, templates = [], onSaveTemplate, disabled = false }: Props) {
  const policy = useMemo(() => normalizeViewPolicy(value), [value])
  const [customOpen, setCustomOpen] = useState(Object.keys(policy.overrides).length > 0)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const chooseLevel = (base: BackOfficeViewLevel) => {
    setCustomOpen(false)
    onChange(defaultViewPolicy(base))
  }

  const setMode = (id: string, mode: BackOfficeViewMode) => {
    const overrides = { ...policy.overrides }
    delete overrides[id]
    const inherited = viewMode({ ...policy, overrides }, id)
    if (mode === inherited) delete overrides[id]
    else overrides[id] = mode
    onChange({ ...policy, overrides })
  }

  const saveTemplate = async () => {
    if (!onSaveTemplate || !templateName.trim()) return
    setSavingTemplate(true)
    try {
      await onSaveTemplate(templateName.trim(), policy)
      setTemplateName('')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {VIEW_LEVELS.map(level => {
          const selected = !customOpen && policy.base === level.id && Object.keys(policy.overrides).length === 0
          return (
            <button
              key={level.id}
              type="button"
              disabled={disabled}
              onClick={() => chooseLevel(level.id)}
              className={`min-h-24 rounded-lg border p-3 text-left transition ${selected ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border bg-white/[0.025]'}`}
            >
              <span className="block text-sm font-semibold text-dash-cream">{level.label}</span>
              <span className="mt-1 block text-xs leading-5 text-dash-tertiary">{level.description}</span>
            </button>
          )
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCustomOpen(true)}
          className={`min-h-24 rounded-lg border p-3 text-left transition ${customOpen ? 'border-shell-accent bg-shell-accent/10' : 'border-dash-border bg-white/[0.025]'}`}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-dash-cream"><Eye size={15} />Custom</span>
          <span className="mt-1 block text-xs leading-5 text-dash-tertiary">Choose every tab and control group.</span>
        </button>
      </div>

      {templates.length ? (
        <div>
          <p className="label-mono mb-2">Saved views</p>
          <div className="flex flex-wrap gap-2">
            {templates.map(template => (
              <button
                key={template.id}
                type="button"
                disabled={disabled}
                onClick={() => { onChange(normalizeViewPolicy(template.policy)); setCustomOpen(true) }}
                className="rounded-lg border border-dash-border px-3 py-2 text-xs font-semibold text-dash-secondary hover:border-shell-accent/50"
              >
                {template.name} <span className="text-dash-tertiary">v{template.version}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {customOpen ? (
        <div className="overflow-hidden rounded-lg border border-dash-border">
          <div className="flex flex-wrap items-end gap-3 border-b border-dash-border bg-white/[0.025] p-3">
            <label className="text-xs font-semibold text-dash-secondary">
              Starting point
              <select
                value={policy.base}
                disabled={disabled}
                onChange={event => onChange({ ...policy, base: event.target.value as BackOfficeViewLevel })}
                className="ml-2 rounded-lg border border-dash-border bg-dash-base px-3 py-2 text-sm text-dash-cream"
              >
                {VIEW_LEVELS.map(level => <option key={level.id} value={level.id}>{level.label}</option>)}
              </select>
            </label>
            <span className="ml-auto text-xs text-dash-tertiary">{Object.keys(policy.overrides).length} custom overrides</span>
          </div>
          {BACK_OFFICE_VIEW_CATALOG.map(item => (
            <CapabilityRow key={item.id} item={item} policy={policy} onMode={setMode} disabled={disabled} />
          ))}
        </div>
      ) : null}

      {customOpen && onSaveTemplate ? (
        <div className="flex flex-wrap gap-2">
          <input
            value={templateName}
            onChange={event => setTemplateName(event.target.value)}
            placeholder="Template name"
            className="min-h-10 min-w-[220px] flex-1 rounded-lg border border-dash-border bg-transparent px-3 text-sm text-dash-cream"
          />
          <button
            type="button"
            disabled={disabled || savingTemplate || !templateName.trim()}
            onClick={() => void saveTemplate()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-shell-accent/50 px-3 text-sm font-semibold text-shell-accent disabled:opacity-40"
          >
            <Save size={14} />{savingTemplate ? 'Saving...' : 'Save reusable view'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
