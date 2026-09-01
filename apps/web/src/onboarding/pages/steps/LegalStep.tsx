import { useEffect, useRef, useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import {
  collapseEntryWhitespace,
  emailError,
  formatEinInput,
  formatUsPhoneInput,
  normalizeEmailInput,
  usPhoneError,
  einError,
} from '@shire/settings'

interface LegalStepProps {
  onboarding: UseOnboardingReturn
}

export function LegalStep({ onboarding }: LegalStepProps) {
  const { data, updateData, saveLegal, nextStep, isLoading, error } = onboarding
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scale = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * scale))
    canvas.height = Math.max(1, Math.floor(rect.height * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(scale, scale)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#f4f1e8'

    if (data.tos_signature_data_url) {
      const image = new Image()
      image.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height)
        ctx.drawImage(image, 0, 0, rect.width, rect.height)
      }
      image.src = data.tos_signature_data_url
    }
  }, [data.tos_signature_data_url])

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const beginSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const point = pointerPosition(event)
    drawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const ctx = event.currentTarget.getContext('2d')
    if (!ctx) return
    const point = pointerPosition(event)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const endSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = event.currentTarget
    canvas.releasePointerCapture(event.pointerId)
    updateData({
      tos_signature_data_url: canvas.toDataURL('image/png'),
      tos_signed_at: new Date().toISOString(),
    })
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    updateData({ tos_signature_data_url: null, tos_signed_at: null })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLocalError(null)
    if (!data.legal_business_name.trim()) {
      setLocalError('Legal business name is required.')
      return
    }
    if (!data.legal_contact_name.trim()) {
      setLocalError('Authorized signer name is required.')
      return
    }
    const einIssue = einError(data.ein)
    if (einIssue) {
      setLocalError(einIssue)
      return
    }
    const emailIssue = emailError(data.legal_contact_email)
    if (emailIssue) {
      setLocalError(emailIssue)
      return
    }
    const phoneIssue = usPhoneError(data.legal_contact_phone)
    if (phoneIssue) {
      setLocalError(phoneIssue)
      return
    }
    if (!data.tos_signature_data_url || !data.tos_signed_at) {
      setLocalError('Please sign the terms before continuing.')
      return
    }

    updateData({
      legal_business_name: collapseEntryWhitespace(data.legal_business_name),
      dba_name: collapseEntryWhitespace(data.dba_name),
      legal_contact_name: collapseEntryWhitespace(data.legal_contact_name),
      legal_contact_title: collapseEntryWhitespace(data.legal_contact_title),
      legal_contact_email: normalizeEmailInput(data.legal_contact_email),
    })

    try {
      await saveLegal()
      nextStep()
    } catch {
      // Error is surfaced by the hook.
    }
  }

  const displayError = localError || error

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {displayError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {displayError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 sm:col-span-2">
          <span className="label-mono text-[rgb(var(--gold))]">Legal Business Name *</span>
          <input
            value={data.legal_business_name}
            maxLength={240}
            onChange={(event) => updateData({ legal_business_name: event.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="The Golden Fork LLC"
          />
        </label>
        <label className="block space-y-2">
          <span className="label-mono text-[rgb(var(--gold))]">DBA / Trade Name</span>
          <input
            value={data.dba_name}
            maxLength={240}
            onChange={(event) => updateData({ dba_name: event.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="The Golden Fork"
          />
        </label>
        <label className="block space-y-2">
          <span className="label-mono text-[rgb(var(--gold))]">EIN</span>
          <input
            value={data.ein}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => updateData({ ein: formatEinInput(event.target.value) })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="12-3456789"
          />
        </label>
        <label className="block space-y-2">
          <span className="label-mono text-[rgb(var(--gold))]">Authorized Signer *</span>
          <input
            value={data.legal_contact_name}
            maxLength={160}
            onChange={(event) => updateData({ legal_contact_name: event.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="Owner or officer name"
          />
        </label>
        <label className="block space-y-2">
          <span className="label-mono text-[rgb(var(--gold))]">Signer Title</span>
          <input
            value={data.legal_contact_title}
            maxLength={120}
            onChange={(event) => updateData({ legal_contact_title: event.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="Owner"
          />
        </label>
        <label className="block space-y-2">
          <span className="label-mono text-[rgb(var(--gold))]">Legal Contact Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={data.legal_contact_email}
            onChange={(event) => updateData({ legal_contact_email: event.target.value })}
            onBlur={() => updateData({ legal_contact_email: normalizeEmailInput(data.legal_contact_email) })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="owner@restaurant.com"
          />
        </label>
        <label className="block space-y-2">
          <span className="label-mono text-[rgb(var(--gold))]">Legal Contact Phone</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={data.legal_contact_phone}
            onChange={(event) => updateData({ legal_contact_phone: formatUsPhoneInput(event.target.value) })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)]"
            placeholder="(555) 123-4567"
          />
        </label>
      </div>

      <section className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="label-mono text-[rgb(var(--gold))]">Placeholder Shire Terms of Service</p>
        <div className="mt-3 max-h-36 overflow-auto rounded-lg border border-[rgba(255,255,255,0.08)] bg-black/20 p-3 text-sm leading-6 text-[rgb(var(--text-secondary))]">
          By signing, the authorized restaurant representative confirms that the information entered during setup is accurate, authorizes Shire to configure restaurant operations based on this setup, and agrees to complete payment processing and hardware validation before go-live. Final production terms will replace this placeholder agreement.
        </div>
        <div className="mt-4">
          <canvas
            ref={canvasRef}
            onPointerDown={beginSignature}
            onPointerMove={drawSignature}
            onPointerUp={endSignature}
            onPointerCancel={endSignature}
            className="h-36 w-full touch-none rounded-lg border border-dashed border-[rgba(255,255,255,0.25)] bg-black/25"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[rgb(var(--text-tertiary))]">
              {data.tos_signed_at ? `Signed ${new Date(data.tos_signed_at).toLocaleString()}` : 'Draw your signature above.'}
            </p>
            <button
              type="button"
              onClick={clearSignature}
              className="rounded-lg border border-[rgba(255,255,255,0.14)] px-3 py-2 text-sm text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]"
            >
              Clear signature
            </button>
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 px-6 bg-white text-black hover:bg-gray-100 disabled:opacity-50 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  )
}
