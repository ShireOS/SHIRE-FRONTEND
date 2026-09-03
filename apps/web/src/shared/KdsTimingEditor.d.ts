import type { TicketAgeColors } from './kdsPresentation'

export interface KdsTimingEditorProps {
  colors: unknown
  rushAfterSeconds: number
  onColorsChange: (value: TicketAgeColors) => void
  onRushAfterChange: (value: number) => void
  title?: string
}
export default function KdsTimingEditor(props: KdsTimingEditorProps): JSX.Element
