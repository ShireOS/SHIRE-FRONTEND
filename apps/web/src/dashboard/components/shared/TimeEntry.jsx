function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

export function formatTimeEntry(value) {
  let digits = digitsOnly(value)
  if (digits.length > 0 && !['0', '1'].includes(digits[0])) {
    digits = `0${digits}`
  }
  digits = digits.slice(0, 4)
  if (digits.length < 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function TimeEntry({ value, onChange, placeholder = '10:00', ariaLabel, className = '' }) {
  const safeValue = value || ''
  const remainder = safeValue.length < placeholder.length ? placeholder.slice(safeValue.length) : ''

  const moveCaretToEnd = (event) => {
    requestAnimationFrame(() => {
      const length = event.target.value.length
      event.target.setSelectionRange(length, length)
    })
  }

  const handleKeyDown = (event) => {
    const allowedKeys = ['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape', 'Enter']
    if (allowedKeys.includes(event.key)) return

    const input = event.currentTarget
    const hasSelection = input.selectionStart !== input.selectionEnd
    const currentDigits = hasSelection ? '' : digitsOnly(safeValue)

    if (/^\d$/.test(event.key)) {
      event.preventDefault()
      onChange(formatTimeEntry(`${currentDigits}${event.key}`))
      return
    }

    if (event.key === 'Backspace') {
      event.preventDefault()
      onChange(formatTimeEntry(hasSelection ? '' : currentDigits.slice(0, -1)))
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      if (hasSelection) onChange('')
      return
    }

    event.preventDefault()
  }

  const handlePaste = (event) => {
    event.preventDefault()
    onChange(formatTimeEntry(event.clipboardData.getData('text')))
  }

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center rounded-xl px-3 py-2 font-mono text-sm">
        <span className="text-dash-cream">{safeValue}</span>
        <span className="text-dash-tertiary/30">{remainder}</span>
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={safeValue}
        onChange={event => onChange(formatTimeEntry(event.target.value))}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={moveCaretToEnd}
        onClick={moveCaretToEnd}
        placeholder={placeholder}
        maxLength={5}
        className="relative z-10 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-sm text-transparent caret-white outline-none placeholder:text-transparent focus:border-dash-gold/70"
      />
    </div>
  )
}
