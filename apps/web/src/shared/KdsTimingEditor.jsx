import { normalizeTicketAgeColors, ticketTimingError } from './kdsPresentation'

const inputClass = 'mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300/60'

function ColorField({ label, value, onChange, detail }) {
  return <label className="block rounded-xl border border-white/10 bg-black/15 p-3">
    <span className="flex items-center justify-between gap-3 text-sm font-semibold text-white"><span>{label}</span><input aria-label={`${label} header color`} type="color" value={value} onChange={event => onChange(event.target.value.toUpperCase())} className="h-9 w-14 cursor-pointer rounded border border-white/15 bg-transparent p-0.5" /></span>
    {detail && <span className="mt-1 block text-xs text-white/50">{detail}</span>}
  </label>
}

function TimedColorField({ label, stage, onChange, detail }) {
  return <div className="rounded-xl border border-white/10 bg-black/15 p-3">
    <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">{label}</span><input aria-label={`${label} header color`} type="color" value={stage.color} onChange={event => onChange({ ...stage, color: event.target.value.toUpperCase() })} className="h-9 w-14 cursor-pointer rounded border border-white/15 bg-transparent p-0.5" /></div>
    <label className="mt-2 block text-xs text-white/55">Starts after (minutes)<input aria-label={`${label} starts after minutes`} type="number" min="0" max="120" step="0.5" value={stage.after_seconds / 60} onChange={event => onChange({ ...stage, after_seconds: Math.round(Number(event.target.value) * 60) })} className={inputClass} /></label>
    {detail && <span className="mt-2 block text-xs text-white/50">{detail}</span>}
  </div>
}

export default function KdsTimingEditor({ colors, rushAfterSeconds, onColorsChange, onRushAfterChange, title = 'Ticket age colors' }) {
  const value = normalizeTicketAgeColors(colors)
  const validation = ticketTimingError(value, Number(rushAfterSeconds))
  return <div>
    <div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-1 text-xs text-white/50">Only the ticket header changes color. Rush keeps its clock label and pulses red.</p></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <ColorField label="Normal" value={value.normal} onChange={normal => onColorsChange({ ...value, normal })} detail="Used before the first warning time." />
      <TimedColorField label="Warning" stage={value.warning} onChange={warning => onColorsChange({ ...value, warning })} />
      <TimedColorField label="Late" stage={value.late} onChange={late => onColorsChange({ ...value, late })} />
      <div className="rounded-xl border border-red-300/20 bg-red-500/5 p-3">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">Rush · flashing</span><input aria-label="Rush header color" type="color" value={value.rush} onChange={event => onColorsChange({ ...value, rush: event.target.value.toUpperCase() })} className="h-9 w-14 cursor-pointer rounded border border-white/15 bg-transparent p-0.5" /></div>
        <label className="mt-2 block text-xs text-white/55">Starts after (minutes)<input aria-label="Rush starts after minutes" type="number" min="0.0167" max="120" step="0.5" value={Number(rushAfterSeconds) / 60} onChange={event => onRushAfterChange(Math.round(Number(event.target.value) * 60))} className={inputClass} /></label>
        <span className="mt-2 block text-xs text-red-200/70">Rush colors must remain red so this state is unmistakable.</span>
      </div>
    </div>
    {validation && <p role="alert" className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{validation}</p>}
  </div>
}
