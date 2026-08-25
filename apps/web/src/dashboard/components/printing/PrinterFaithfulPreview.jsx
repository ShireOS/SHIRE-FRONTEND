import { useMemo } from 'react'
import { printerPreviewDataUrl, printerPreviewGeometry } from './printerPreviewDataUrl'

export default function PrinterFaithfulPreview({ svg, alt, impact = false, paperWidthMm = impact ? 76 : 80 }) {
  const source = useMemo(() => printerPreviewDataUrl(svg), [svg])
  if (!source) return null
  const geometry = printerPreviewGeometry(paperWidthMm, impact ? 'impact' : 'thermal')
  return (
    <div
      className="mx-auto max-w-full overflow-hidden bg-[#fffdf6] text-black shadow-2xl"
      style={{
        width: `${geometry.paperWidthPx}px`,
      }}
    >
      <img
        src={source}
        alt={alt}
        className="mx-auto block h-auto max-w-full mix-blend-multiply"
        style={{ width: `${geometry.printableWidthPx}px` }}
      />
    </div>
  )
}
