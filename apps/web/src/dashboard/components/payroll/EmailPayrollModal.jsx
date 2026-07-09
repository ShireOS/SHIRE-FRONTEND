import { useMemo, useState } from 'react'
import { Mail, X } from 'lucide-react'
import { fetchWithSupabaseAuth } from '../../../shared/query'
import { intervalLabel } from '../../utils/payrollIntervals'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmailPayrollModal({
  restaurantId,
  run,
  rows,
  restaurantName,
  defaultRecipients = [],
  onClose,
  onFallbackExport,
}) {
  const [recipients, setRecipients] = useState(defaultRecipients.join(', '))
  const [format, setFormat] = useState('pdf_summary')
  const [includeCsv, setIncludeCsv] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const recipientList = useMemo(() => recipients.split(',').map((item) => item.trim()).filter(Boolean), [recipients])
  const invalid = recipientList.filter((email) => !EMAIL_RE.test(email))
  const period = intervalLabel({ start: (run?.window_start || '').slice(0, 10), end: (run?.window_end || '').slice(0, 10) })
  const subject = `${restaurantName || 'Payroll'} payroll - ${period}`
  const hasStubs = rows?.length > 0

  const send = async () => {
    setMessage('')
    setError('')
    if (!recipientList.length) {
      setError('Add at least one recipient.')
      return
    }
    if (invalid.length) {
      setError(`Check ${invalid.join(', ')}.`)
      return
    }
    setSending(true)
    try {
      await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/payroll/email`, {
        method: 'POST',
        body: JSON.stringify({
          recipients: recipientList,
          subject,
          note,
          format,
          include_csv: includeCsv,
          run: {
            id: run?.id || null,
            window_start: run?.window_start,
            window_end: run?.window_end,
            status: run?.status || 'preview',
          },
          rows,
        }),
      })
      setMessage('Payroll email queued.')
    } catch (err) {
      const text = err?.status === 404 || /not found|404/i.test(err?.message || '')
        ? 'Email service is not configured yet. Download the attachment and send it from your email client.'
        : err?.message || 'Could not send payroll email.'
      setError(text)
    } finally {
      setSending(false)
    }
  }

  const fallbackVariant = format === 'pay_stubs' ? 'stubs' : 'summary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-dash-gold" />
              <p className="label-mono text-dash-tertiary">Email payroll</p>
            </div>
            <h2 className="mt-1 text-xl font-semibold text-dash-cream">{period}</h2>
            <p className="mt-1 text-sm text-dash-secondary">PDF summary is selected by default. CSV can be attached for payroll import.</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="rounded-lg p-1.5 text-dash-tertiary hover:bg-dash-cream/10 hover:text-dash-cream">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="label-mono text-dash-tertiary">Recipients</span>
            <input
              type="text"
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              placeholder="owner@example.com, accountant@example.com"
              className="mt-1 w-full rounded-lg border border-dash-border bg-transparent px-3 py-2 text-sm text-dash-cream outline-none focus:border-dash-gold/60"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-mono text-dash-tertiary">Primary attachment</span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                className="mt-1 w-full rounded-lg border border-dash-border bg-dash-panel px-3 py-2 text-sm text-dash-cream outline-none focus:border-dash-gold/60"
              >
                <option value="pdf_summary">PDF summary</option>
                <option value="csv">CSV import file</option>
                <option value="pay_stubs" disabled={!hasStubs}>PDF pay stubs</option>
              </select>
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm text-dash-secondary">
              <input
                type="checkbox"
                checked={includeCsv}
                onChange={(event) => setIncludeCsv(event.target.checked)}
                className="h-4 w-4 accent-dash-gold"
              />
              Attach CSV too
            </label>
          </div>

          <label className="block">
            <span className="label-mono text-dash-tertiary">Note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional message for the owner, accountant, or payroll provider."
              className="mt-1 min-h-24 w-full rounded-lg border border-dash-border bg-transparent px-3 py-2 text-sm text-dash-cream outline-none focus:border-dash-gold/60"
            />
          </label>

          <div className="rounded-xl border border-dash-border bg-white/[0.025] p-3 text-xs text-dash-secondary">
            <span className="font-semibold text-dash-cream">Attachment preview:</span> {format === 'csv' ? 'CSV payroll import' : format === 'pay_stubs' ? `${rows.length} pay stub pages` : 'PDF payroll summary'}{includeCsv && format !== 'csv' ? ' + CSV import' : ''}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/[0.08] p-3 text-sm text-amber-100">
            <p>{error}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => onFallbackExport(format === 'csv' ? 'csv' : fallbackVariant)} className="rounded-lg border border-amber-300/50 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/10">
                Download selected format
              </button>
              {includeCsv && format !== 'csv' ? (
                <button type="button" onClick={() => onFallbackExport('csv')} className="rounded-lg border border-amber-300/50 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/10">
                  Download CSV
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {message ? <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-dash-border px-3 py-2 text-sm text-dash-secondary hover:text-dash-cream">Cancel</button>
          <button type="button" onClick={send} disabled={sending} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-3 py-2 text-sm font-semibold text-dash-gold hover:bg-dash-gold/20 disabled:opacity-50">
            {sending ? 'Sending...' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  )
}
