export const BUNDLED_PREVIEW_PATHS = Object.freeze({
  pos: '/previews/pos/index.html',
  host: '/previews/host/index.html',
})

export function resolvePreviewUrls(configuredUrl, fallbackUrls = []) {
  const configured = String(configuredUrl || '').trim()
  if (configured) return [configured]
  return fallbackUrls
}
