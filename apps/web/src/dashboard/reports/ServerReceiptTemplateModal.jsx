import { useEffect, useMemo, useState } from 'react'
import { Check, LockKeyhole, RefreshCw, Save, X } from 'lucide-react'

import { fetchPosApi } from '../../shared/api/posClient'
import {
  DEFAULT_SERVER_RECEIPT_TEMPLATE,
  SERVER_RECEIPT_PRESETS,
  SERVER_RECEIPT_SECTION_IDS,
  normalizeServerReceiptTemplate,
  serverReceiptPresetFor,
  toggleServerReceiptSection,
} from './serverReceiptTemplatePolicy'

const SECTION_LABELS = {
  tax: ['Tax', 'Taxable, non-taxable, and tax collected.'],
  sales: ['Sales', 'Gross sales, sales tax, and net sales.'],
  tenders: ['Tenders', 'Cash, card, gift card, and other totals.'],
  tips: ['Tips', 'Tips, tip-out owed, and card-tip fee when used.'],
  checks: ['Check counts', 'Total checks and open checks.'],
}

const SIZE_LABELS = {
  compact: 'Compact',
  medium: 'Medium',
  large: 'Large',
}

function ChoiceButton({ selected, onClick, children }) {
  return <button type="button" onClick={onClick} className={`min-h-10 rounded-md border px-3 text-sm font-semibold transition ${selected ? 'border-dash-gold bg-dash-gold/10 text-dash-cream' : 'border-white/10 bg-white/[0.025] text-dash-secondary hover:bg-white/[0.06] hover:text-dash-cream'}`}>{children}</button>
}

export default function ServerReceiptTemplateModal({ restaurantId, onClose, onSaved }) {
  const [draft, setDraft] = useState(DEFAULT_SERVER_RECEIPT_TEMPLATE)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const activePreset = useMemo(() => serverReceiptPresetFor(draft), [draft])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoaded(false)
    setPreview(null)
    setError('')
    fetchPosApi(restaurantId, '/manager/report-hub/server-receipt-config')
      .then((result) => {
        if (cancelled) return
        setDraft(normalizeServerReceiptTemplate(result?.report))
        setLoaded(true)
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Could not load the saved server receipt.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId])

  useEffect(() => {
    if (!loaded) return undefined
    let cancelled = false
    setPreviewing(true)
    const timeout = window.setTimeout(() => {
      fetchPosApi(restaurantId, '/manager/report-hub/server-receipt-preview', {
        method: 'POST',
        body: JSON.stringify(draft),
      })
        .then((result) => {
          if (cancelled) return
          setPreview(result)
          setError('')
        })
        .catch((nextError) => {
          if (cancelled) return
          setPreview(null)
          setError(nextError instanceof Error ? nextError.message : 'The receipt preview could not be rendered.')
        })
        .finally(() => { if (!cancelled) setPreviewing(false) })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [draft, loaded, restaurantId])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const result = await fetchPosApi(restaurantId, '/manager/report-hub/server-receipt-config', {
        method: 'PUT',
        body: JSON.stringify(draft),
      })
      onSaved?.(normalizeServerReceiptTemplate(result?.report))
      onClose()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save the server receipt.')
    } finally {
      setSaving(false)
    }
  }

  const capabilities = preview?.printer_capabilities || {}
  const previewMeta = [
    capabilities.paper_width_mm ? `${capabilities.paper_width_mm} mm` : null,
    SIZE_LABELS[draft.size],
    preview?.target_id ? 'configured receipt printer' : 'default printer profile',
    preview?.renderer_version || 'production renderer',
  ].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="server-receipt-template-title">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-white/10 bg-dash-surface shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="server-receipt-template-title" className="text-xl font-semibold">Configure server receipt</h2>
            <p className="mt-1 text-sm text-dash-secondary">Choose optional detail here. Cash settlement always prints and keeps the existing checkout math.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close server receipt configuration" className="rounded-md p-2 text-dash-secondary hover:bg-white/10 hover:text-dash-cream disabled:opacity-40"><X className="h-5 w-5" /></button>
        </header>

        {loading ? <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-dash-secondary"><RefreshCw className="h-5 w-5 animate-spin text-dash-gold" />Loading saved receipt…</div> : (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[390px_1fr] lg:overflow-hidden">
            <div className="border-b border-white/10 bg-white/[0.018] p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-tertiary">Preset</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {Object.entries(SERVER_RECEIPT_PRESETS).map(([preset, sections]) => <ChoiceButton key={preset} selected={activePreset === preset} onClick={() => setDraft((current) => ({ ...current, sections: [...sections] }))}>{preset === 'minimal' ? 'Bare minimum' : preset[0].toUpperCase() + preset.slice(1)}</ChoiceButton>)}
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-dash-tertiary">Text size</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {Object.entries(SIZE_LABELS).map(([size, label]) => <ChoiceButton key={size} selected={draft.size === size} onClick={() => setDraft((current) => ({ ...current, size }))}>{label}</ChoiceButton>)}
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-dash-tertiary">Receipt sections</p>
              <div className="mt-2 space-y-2">
                <div className="flex min-h-16 items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-dash-gold text-black"><LockKeyhole className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Cash settlement</p><p className="mt-1 text-xs leading-5 text-dash-tertiary">Cash Collected, Non-cash tips owed, and Cash Due to Restaurant.</p></div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-dash-tertiary">Required</span>
                </div>
                {SERVER_RECEIPT_SECTION_IDS.map((section) => {
                  const selected = draft.sections.includes(section)
                  const [label, detail] = SECTION_LABELS[section]
                  return <button key={section} type="button" role="checkbox" aria-checked={selected} onClick={() => setDraft((current) => toggleServerReceiptSection(current, section))} className={`flex min-h-16 w-full items-center gap-3 rounded-md border p-3 text-left transition ${selected ? 'border-dash-gold/60 bg-dash-gold/[0.07]' : 'border-white/10 bg-white/[0.018] hover:bg-white/[0.045]'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${selected ? 'bg-dash-gold text-black' : 'border border-white/15 bg-white/[0.025]'}`}>{selected ? <Check className="h-4 w-4" /> : null}</span><span><span className="block text-sm font-semibold text-dash-cream">{label}</span><span className="mt-1 block text-xs leading-5 text-dash-tertiary">{detail}</span></span></button>
                })}
              </div>
            </div>

            <div className="min-w-0 bg-dash-base p-5 lg:overflow-y-auto">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div><h3 className="font-semibold">Actual receipt preview</h3><p className="mt-1 text-xs text-dash-tertiary">{previewMeta}</p></div>
                {previewing ? <RefreshCw className="h-4 w-4 animate-spin text-dash-gold" /> : null}
              </div>
              <div className="flex justify-center overflow-x-auto pb-5">
                <div className={`min-h-[560px] max-w-full bg-[#fffefa] px-6 py-7 shadow-xl ${draft.size === 'compact' ? 'w-[440px]' : draft.size === 'large' ? 'w-[340px]' : 'w-[390px]'}`}>
                  {preview?.preview ? <pre className={`whitespace-pre-wrap font-mono leading-relaxed text-[#17130f] ${draft.size === 'compact' ? 'text-[11px]' : draft.size === 'large' ? 'text-[13px]' : 'text-xs'}`}>{preview.preview}</pre> : <p className="py-20 text-center text-sm text-stone-500">{previewing ? 'Rendering receipt…' : 'Preview unavailable.'}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="flex shrink-0 flex-col gap-3 border-t border-white/10 bg-dash-surface px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">{error ? <p className="text-sm text-red-300">{error}</p> : <p className="text-xs text-dash-tertiary">Saving applies this template restaurant-wide to future server checkout receipt prints.</p>}</div>
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-md border border-white/10 px-4 text-sm font-semibold text-dash-secondary disabled:opacity-40">Cancel</button><button type="button" onClick={save} disabled={!loaded || saving || previewing || !preview?.preview} className="inline-flex h-10 items-center gap-2 rounded-md bg-dash-gold px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save restaurant-wide'}</button></div>
        </footer>
      </div>
    </div>
  )
}
