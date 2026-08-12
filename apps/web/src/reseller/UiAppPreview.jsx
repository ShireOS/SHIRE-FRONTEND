import { useEffect, useMemo, useRef, useState } from 'react'
import { Expand, ExternalLink, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { BUNDLED_PREVIEW_PATHS, resolvePreviewUrls } from './previewConfig'

function withPreviewFlag(url) {
  const parsed = new URL(url, window.location.origin)
  parsed.searchParams.set('shirePreview', '1')
  return parsed.toString()
}

function previewUrls(service) {
  const configured = service === 'pos'
    ? import.meta.env.VITE_POS_UI_PREVIEW_URL
    : import.meta.env.VITE_HOST_UI_PREVIEW_URL
  return resolvePreviewUrls(configured, [BUNDLED_PREVIEW_PATHS[service]])
    .map(withPreviewFlag)
}

function previewVersionLabel(preview) {
  if (!preview) return ''
  const updateNumber = Number(preview.updateNumber)
  const commit = String(preview.sourceCommit || '').trim().slice(0, 8)
  const parts = []
  if (Number.isInteger(updateNumber) && updateNumber > 0) parts.push(`POS update ${updateNumber}`)
  if (commit) parts.push(commit)
  return parts.join(' · ')
}

function PreviewFrame({
  service,
  tokens,
  componentOverrides,
  mode,
  menuItems,
  quickMenu,
  menuWorkspace,
  onComponentSelect,
  expanded = false,
}) {
  const frame = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(null)
  const urls = useMemo(() => previewUrls(service), [service])
  const url = urls[candidateIndex]

  const retry = () => {
    setLoaded(false)
    setFailed(false)
    setPreviewVersion(null)
    setCandidateIndex(0)
  }

  useEffect(() => {
    setLoaded(false)
    setPreviewVersion(null)
  }, [service, url])

  const sendState = () => {
    if (!url) return
    const targetOrigin = new URL(url).origin
    frame.current?.contentWindow?.postMessage({
      type: 'shire-ui-preview-state',
      service,
      tokens,
      componentOverrides,
      mode,
      menuItems,
      quickMenu,
      menuWorkspace,
    }, targetOrigin)
  }

  useEffect(() => {
    if (!url) return undefined
    const receive = (event) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return
      if (event.data?.type === 'shire-ui-preview-ready' && event.data.service === service) {
        setLoaded(true)
        setPreviewVersion(event.data.preview ?? null)
        sendState()
      }
      if (event.data?.type === 'shire-ui-preview-component-selected' && event.data.service === service) {
        onComponentSelect?.(event.data.component)
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [onComponentSelect, service, url])

  useEffect(() => sendState(), [componentOverrides, menuItems, menuWorkspace, mode, quickMenu, service, tokens, url])

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    setPreviewVersion(null)
    setCandidateIndex(0)
  }, [service])

  useEffect(() => {
    if (loaded) return undefined
    if (urls.length === 0) {
      setFailed(true)
      return undefined
    }
    const timeout = window.setTimeout(() => {
      if (candidateIndex < urls.length - 1) setCandidateIndex((current) => current + 1)
      else setFailed(true)
    }, 15000)
    return () => window.clearTimeout(timeout)
  }, [candidateIndex, loaded, urls.length])

  return <div className={`relative overflow-hidden rounded-md border border-dash-border bg-black ${expanded ? 'h-full w-full' : 'aspect-[4/3] min-h-[620px] min-w-[820px] w-full'}`}>
    {!loaded && <div className="absolute inset-0 z-10 grid place-items-center bg-dash-base"><div className="max-w-sm px-6 text-center">{failed ? <><p className="text-sm font-semibold">Could not open the {service === 'pos' ? 'POS' : 'Host'} sandbox</p><p className="mt-2 text-xs leading-5 text-dash-tertiary">The packaged preview did not finish loading. Retry it, then check the browser console if the problem continues.</p><button type="button" onClick={retry} className="mx-auto mt-4 inline-flex items-center gap-2 rounded-md border border-dash-border px-3 py-2 text-xs font-semibold"><RotateCcw size={14} />Retry preview</button></> : <><LoaderCircle className="mx-auto animate-spin text-dash-tertiary" size={24} /><p className="mt-3 text-sm font-semibold">Opening the real {service === 'pos' ? 'POS' : 'Host'} sandbox</p><p className="mt-1 text-xs text-dash-tertiary">Loading the packaged application preview.</p></>}</div></div>}
    {url && <iframe
      ref={frame}
      title={`${service === 'pos' ? 'POS' : 'Host'} sandbox preview`}
      src={url}
      onLoad={() => window.setTimeout(sendState, 100)}
      className="h-full w-full border-0 bg-white"
      allow="clipboard-read; clipboard-write"
    />}
    {loaded && previewVersionLabel(previewVersion) && <div className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-black/65 shadow-sm backdrop-blur">
      {previewVersionLabel(previewVersion)}
    </div>}
  </div>
}

export default function UiAppPreview({
  service,
  tokens,
  componentOverrides,
  mode,
  menuItems,
  quickMenu,
  menuWorkspace,
  onComponentSelect,
}) {
  const [expanded, setExpanded] = useState(false)
  const url = useMemo(() => previewUrls(service)[0], [service])

  return <>
    <div className="overflow-x-auto pb-2"><PreviewFrame key={`${service}:${mode === 'quick-menu' || mode === 'menu-workspace' ? mode : 'theme'}`} service={service} tokens={tokens} componentOverrides={componentOverrides} mode={mode} menuItems={menuItems} quickMenu={quickMenu} menuWorkspace={menuWorkspace} onComponentSelect={onComponentSelect} /></div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" title="Open full-screen preview" onClick={() => setExpanded(true)} className="inline-flex items-center gap-2 rounded-md border border-dash-border px-3 py-2 text-xs font-semibold"><Expand size={14} />Open full screen</button>
      {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-dash-border px-3 py-2 text-xs font-semibold"><ExternalLink size={14} />Open sandbox separately</a>}
    </div>
    {expanded && <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 p-3 sm:p-5"><div className="mx-auto mb-3 flex w-full max-w-[1440px] items-center justify-between text-white"><div><strong>Real {service === 'pos' ? 'POS' : 'Host'} sandbox</strong><p className="text-xs text-white/60">Uses the service's actual components with in-memory preview data.</p></div><button type="button" title="Close full-screen preview" onClick={() => setExpanded(false)} className="grid h-10 w-10 place-items-center rounded-md border border-white/20"><X size={18} /></button></div><div className="mx-auto min-h-0 w-full max-w-[1440px] flex-1"><PreviewFrame service={service} tokens={tokens} componentOverrides={componentOverrides} mode={mode} menuItems={menuItems} quickMenu={quickMenu} menuWorkspace={menuWorkspace} onComponentSelect={onComponentSelect} expanded /></div></div>}
  </>
}
