import { useEffect, useMemo, useRef, useState } from 'react'
import { Expand, ExternalLink, LoaderCircle, RotateCcw, X } from 'lucide-react'

const LOCAL_PREVIEW_PORTS = {
  pos: [8082, 8081],
  host: [8081, 8082],
}

function withPreviewFlag(url) {
  const parsed = new URL(url, window.location.origin)
  parsed.searchParams.set('shirePreview', '1')
  return parsed.toString()
}

function previewUrls(service) {
  const configured = service === 'pos'
    ? import.meta.env.VITE_POS_UI_PREVIEW_URL
    : import.meta.env.VITE_HOST_UI_PREVIEW_URL
  if (configured?.trim()) return [withPreviewFlag(configured.trim())]
  return LOCAL_PREVIEW_PORTS[service].map((port) => withPreviewFlag(`http://localhost:${port}/`))
}

function PreviewFrame({
  service,
  tokens,
  componentOverrides,
  mode,
  menuItems,
  quickMenu,
  onComponentSelect,
  expanded = false,
}) {
  const frame = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const urls = useMemo(() => previewUrls(service), [service])
  const url = urls[candidateIndex]

  const retry = () => {
    setLoaded(false)
    setFailed(false)
    setCandidateIndex(0)
  }

  const sendState = () => {
    const targetOrigin = new URL(url).origin
    frame.current?.contentWindow?.postMessage({
      type: 'shire-ui-preview-state',
      service,
      tokens,
      componentOverrides,
      mode,
      menuItems,
      quickMenu,
    }, targetOrigin)
  }

  useEffect(() => {
    const receive = (event) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return
      if (event.data?.type === 'shire-ui-preview-ready' && event.data.service === service) {
        setLoaded(true)
        sendState()
      }
      if (event.data?.type === 'shire-ui-preview-component-selected' && event.data.service === service) {
        onComponentSelect?.(event.data.component)
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [onComponentSelect, service, url])

  useEffect(() => sendState(), [componentOverrides, menuItems, mode, quickMenu, service, tokens, url])

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    setCandidateIndex(0)
  }, [service])

  useEffect(() => {
    if (loaded) return undefined
    const timeout = window.setTimeout(() => {
      if (candidateIndex < urls.length - 1) setCandidateIndex((current) => current + 1)
      else setFailed(true)
    }, 2500)
    return () => window.clearTimeout(timeout)
  }, [candidateIndex, loaded, urls.length])

  return <div className={`relative overflow-hidden rounded-md border border-dash-border bg-black ${expanded ? 'h-full w-full' : 'aspect-[4/3] min-h-[620px] min-w-[820px] w-full'}`}>
    {!loaded && <div className="absolute inset-0 z-10 grid place-items-center bg-dash-base"><div className="max-w-sm px-6 text-center">{failed ? <><p className="text-sm font-semibold">Could not reach the {service === 'pos' ? 'POS' : 'Host'} sandbox</p><p className="mt-2 text-xs leading-5 text-dash-tertiary">Start its Expo web preview, or configure the hosted preview URL, then try again.</p><button type="button" onClick={retry} className="mx-auto mt-4 inline-flex items-center gap-2 rounded-md border border-dash-border px-3 py-2 text-xs font-semibold"><RotateCcw size={14} />Retry preview</button></> : <><LoaderCircle className="mx-auto animate-spin text-dash-tertiary" size={24} /><p className="mt-3 text-sm font-semibold">Opening the real {service === 'pos' ? 'POS' : 'Host'} sandbox</p><p className="mt-1 text-xs text-dash-tertiary">Checking the local preview server.</p></>}</div></div>}
    <iframe
      ref={frame}
      title={`${service === 'pos' ? 'POS' : 'Host'} sandbox preview`}
      src={url}
      className="h-full w-full border-0 bg-white"
      allow="clipboard-read; clipboard-write"
    />
  </div>
}

export default function UiAppPreview({
  service,
  tokens,
  componentOverrides,
  mode,
  menuItems,
  quickMenu,
  onComponentSelect,
}) {
  const [expanded, setExpanded] = useState(false)
  const url = useMemo(() => previewUrls(service)[0], [service])

  return <>
    <div className="overflow-x-auto pb-2"><PreviewFrame key={`${service}:${mode === 'quick-menu' ? 'quick-menu' : 'theme'}`} service={service} tokens={tokens} componentOverrides={componentOverrides} mode={mode} menuItems={menuItems} quickMenu={quickMenu} onComponentSelect={onComponentSelect} /></div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" title="Open full-screen preview" onClick={() => setExpanded(true)} className="inline-flex items-center gap-2 rounded-md border border-dash-border px-3 py-2 text-xs font-semibold"><Expand size={14} />Open full screen</button>
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-dash-border px-3 py-2 text-xs font-semibold"><ExternalLink size={14} />Open sandbox separately</a>
    </div>
    {expanded && <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 p-3 sm:p-5"><div className="mx-auto mb-3 flex w-full max-w-[1440px] items-center justify-between text-white"><div><strong>Real {service === 'pos' ? 'POS' : 'Host'} sandbox</strong><p className="text-xs text-white/60">Uses the service's actual components with in-memory preview data.</p></div><button type="button" title="Close full-screen preview" onClick={() => setExpanded(false)} className="grid h-10 w-10 place-items-center rounded-md border border-white/20"><X size={18} /></button></div><div className="mx-auto min-h-0 w-full max-w-[1440px] flex-1"><PreviewFrame service={service} tokens={tokens} componentOverrides={componentOverrides} mode={mode} menuItems={menuItems} quickMenu={quickMenu} onComponentSelect={onComponentSelect} expanded /></div></div>}
  </>
}
