export const BUNDLED_PREVIEW_PATHS = Object.freeze({
  pos: '/previews/pos/index.html',
  host: '/previews/host/index.html',
})

export function resolvePreviewUrls(configuredUrl, fallbackUrls = []) {
  const configured = String(configuredUrl || '').trim()
  return [...new Set([
    ...(configured ? [configured] : []),
    ...fallbackUrls.map((url) => String(url || '').trim()).filter(Boolean),
  ])]
}
