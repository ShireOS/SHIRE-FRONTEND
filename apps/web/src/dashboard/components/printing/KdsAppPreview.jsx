import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { normalizeTicketAgeColors } from '../../../shared/kdsPresentation'

const PREVIEW_PATH = '/previews/kds/index.html'

function previewUrl() {
  const url = new URL(PREVIEW_PATH, window.location.origin)
  url.searchParams.set('shirePreview', '1')
  return url.toString()
}

function previewAge(profile, stage) {
  const colors = normalizeTicketAgeColors(profile?.settings?.ticket_age_colors)
  if (stage === 'warning') return colors.warning.after_seconds + 1
  if (stage === 'late') return colors.late.after_seconds + 1
  if (stage === 'rush') return Number(profile?.rush_after_seconds || 900) + 1
  return 0
}

export default function KdsAppPreview({ profile }) {
  const frame = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [capacity, setCapacity] = useState(null)
  const [stage, setStage] = useState('normal')
  const url = useMemo(previewUrl, [])

  const sendState = useCallback(() => frame.current?.contentWindow?.postMessage({
    type: 'shire-ui-preview-state', service: 'kds', profile, previewAgeSeconds: previewAge(profile, stage),
  }, window.location.origin), [profile, stage])

  useEffect(() => {
    const receive = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return
      if (event.data?.type === 'shire-ui-preview-ready' && event.data?.service === 'kds') {
        setLoaded(true); setFailed(false); sendState()
      }
      if (event.data?.type === 'shire-kds-preview-capacity' && event.data?.service === 'kds') {
        const next = Number(event.data.capacity)
        if (Number.isInteger(next) && next >= 0) setCapacity(next)
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [sendState])

  useEffect(() => { if (loaded) sendState() }, [loaded, sendState])
  useEffect(() => {
    if (loaded) return undefined
    const timeout = window.setTimeout(() => setFailed(true), 15_000)
    return () => window.clearTimeout(timeout)
  }, [loaded])

  const retry = () => {
    setLoaded(false); setFailed(false); setCapacity(null)
    if (frame.current) frame.current.src = url
  }

  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Live KDS preview</h2><p className="mt-1 text-xs text-dash-tertiary">The bundled production KDS renders forty identical fake checks. No live restaurant or device data is used.</p></div><div className="rounded-xl border border-dash-gold/25 bg-dash-gold/10 px-3 py-2 text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dash-gold">Visible capacity</p><p className="mt-1 text-sm font-semibold text-dash-cream">{capacity == null ? 'Measuring…' : `Up to ${capacity} standard checks`}</p><p className="text-[10px] text-dash-tertiary">without scrolling</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Preview ticket age">{['normal', 'warning', 'late', 'rush'].map(value => <button key={value} type="button" onClick={() => setStage(value)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${stage === value ? 'border-dash-gold/60 bg-dash-gold/10 text-dash-gold' : 'border-white/10 text-dash-secondary'}`}>{value}</button>)}</div>
    <div className="relative mt-3 aspect-[4/3] min-h-[520px] overflow-hidden rounded-xl border border-white/10 bg-black">
      {!loaded && <div className="absolute inset-0 z-10 grid place-items-center bg-[#111718] text-center">{failed ? <div><p className="text-sm font-semibold">The bundled KDS preview did not load.</p><button type="button" onClick={retry} className="mx-auto mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5" />Retry</button></div> : <div><Loader2 className="mx-auto h-5 w-5 animate-spin text-dash-gold" /><p className="mt-2 text-xs text-dash-tertiary">Opening the real KDS build…</p></div>}</div>}
      <iframe ref={frame} title="Real KDS application preview" src={url} onLoad={() => window.setTimeout(sendState, 100)} className="h-full w-full border-0 bg-black" />
    </div>
  </section>
}
