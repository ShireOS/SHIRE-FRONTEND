import { useEffect, useState } from 'react'
import { fetchPosApi } from '../../../shared/api/posClient'
import { Modal, ModalFooter } from '../shared/Modal'
import {
  buildPrinterEndpointUpdate,
  createPrinterEndpointEditDraft,
  validatePrinterEndpointEditDraft,
} from './printerEndpointEditor'

export default function PrinterEndpointEditModal({ restaurantId, endpoint, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => createPrinterEndpointEditDraft(endpoint))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(createPrinterEndpointEditDraft(endpoint))
    setError('')
  }, [endpoint])

  const save = async event => {
    event.preventDefault()
    if (!endpoint) return
    const validationError = validatePrinterEndpointEditDraft(draft)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      await fetchPosApi(restaurantId, `/restaurants/${restaurantId}/print-infrastructure/endpoints/${endpoint.id}`, {
        method: 'PUT',
        body: JSON.stringify(buildPrinterEndpointUpdate(endpoint, draft)),
      })
      await onSaved?.()
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not update printer IP')
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    if (!saving) onClose()
  }

  return (
    <Modal isOpen={Boolean(endpoint)} onClose={close} title="Edit printer IP" size="sm">
      {endpoint && <form onSubmit={save}>
        <p className="text-sm text-dash-secondary">Update the Ethernet address for <strong className="text-dash-cream">{endpoint.name}</strong>. Its printer assignment, priority, and fallback paths will stay unchanged.</p>
        {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="label-mono">Printer IP or hostname</span><input required autoFocus value={draft.host} onChange={event => setDraft({ ...draft, host: event.target.value })} placeholder="192.168.1.50" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
          <label><span className="label-mono">Port</span><input required type="number" min="1" max="65535" value={draft.port} onChange={event => setDraft({ ...draft, port: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
          <label className="sm:col-span-2"><span className="label-mono">Reason for change</span><input required maxLength="300" value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} placeholder="Printer received a new reserved IP" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" /></label>
        </div>
        <ModalFooter className="mt-5">
          <button type="button" onClick={close} disabled={saving} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-dash-secondary hover:text-white disabled:opacity-50">Cancel</button>
          <button disabled={saving || Boolean(validatePrinterEndpointEditDraft(draft))} className="rounded-lg bg-dash-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{saving ? 'Saving…' : 'Save IP'}</button>
        </ModalFooter>
      </form>}
    </Modal>
  )
}
