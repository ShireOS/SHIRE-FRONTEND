const SAFE_SVG_START = /^\s*<svg\b/i

export function printerPreviewWidthPx(paperWidthMm, fallbackMm = 80) {
  const widthMm = Number(paperWidthMm)
  const safeWidthMm = Number.isFinite(widthMm) && widthMm >= 40 ? widthMm : fallbackMm
  return Math.round(safeWidthMm * 4)
}

export function printerPreviewGeometry(paperWidthMm, family = 'unknown') {
  const paperWidthPx = printerPreviewWidthPx(paperWidthMm, family === 'impact' ? 76 : 80)
  const resolvedPaperMm = paperWidthPx / 4
  // Epson's 76 mm TM-U220 roll has a 63.4 mm printable area. Its 40 Font B
  // cells must sit inside that area rather than being stretched edge-to-edge
  // across the roll. Common Epson thermal layouts similarly reserve the
  // mechanism margins around their 72/48 mm printable canvases.
  const printableWidthMm = family === 'impact' && resolvedPaperMm === 76
    ? 63.4
    : family === 'thermal' && resolvedPaperMm === 58
      ? 48
      : family === 'thermal' && resolvedPaperMm === 80
        ? 72
        : resolvedPaperMm
  return {
    paperWidthPx,
    printableWidthPx: Math.round(printableWidthMm * 4),
  }
}

export function printerPreviewDataUrl(svg) {
  const source = String(svg || '')
  if (!SAFE_SVG_START.test(source)) return ''
  // The SVG comes from Shire's ReceiptLine service and is displayed through an
  // image boundary, never injected into the page DOM. Strip active/embedded
  // document elements as defense in depth before creating the data URL.
  const safe = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safe)}`
}
