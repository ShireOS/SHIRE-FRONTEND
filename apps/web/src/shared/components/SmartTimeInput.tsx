import { Check, Clock3 } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

import {
  formatTimeLabel,
  getTimeSuggestions,
  parseTimeQuery,
  snapTimeToStep,
} from '../utils/timeInput.js'

type SmartTimeInputProps = {
  value?: string | null
  onChange: (value: string) => void
  minuteStep?: 1 | 5 | 10 | 15 | 30
  allowEmpty?: boolean
  id?: string
  name?: string
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  onClose?: () => void
  className?: string
  inputClassName?: string
}

type MenuPosition = {
  left: number
  top: number
  width: number
  maxHeight: number
}

export function SmartTimeInput({
  value,
  onChange,
  minuteStep = 15,
  allowEmpty = true,
  id,
  name,
  ariaLabel,
  placeholder = 'h:mm am',
  disabled = false,
  required = false,
  autoFocus = false,
  onClose,
  className = '',
  inputClassName = '',
}: SmartTimeInputProps) {
  const canonicalValue = String(value || '').slice(0, 5)
  const generatedId = useId().replace(/:/g, '')
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [query, setQuery] = useState(() => formatTimeLabel(canonicalValue))
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const suggestions = useMemo(
    () => getTimeSuggestions({ query, value: canonicalValue, minuteStep }),
    [canonicalValue, minuteStep, query],
  )
  const active = suggestions[activeIndex] || suggestions[0]

  useEffect(() => {
    if (!open) setQuery(formatTimeLabel(canonicalValue))
  }, [canonicalValue, open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, minuteStep])

  const updateMenuPosition = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (!rect) return
    const gap = 6
    const roomBelow = window.innerHeight - rect.bottom - gap
    const roomAbove = rect.top - gap
    const maxHeight = Math.max(160, Math.min(320, Math.max(roomBelow, roomAbove) - 8))
    const top = roomBelow >= 180 || roomBelow >= roomAbove
      ? rect.bottom + gap
      : Math.max(8, rect.top - maxHeight - gap)
    setMenuPosition({ left: rect.left, top, width: rect.width, maxHeight })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open || !active) return
    optionRefs.current.get(active.value)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const close = () => {
    setOpen(false)
    setDirty(false)
    setActiveIndex(0)
    onClose?.()
  }

  const commit = (nextValue?: string) => {
    if (!dirty && nextValue == null) {
      close()
      return
    }
    if (nextValue == null && !query.trim() && allowEmpty) {
      onChange('')
      setQuery('')
      close()
      return
    }

    const parsed = nextValue || parseTimeQuery(query)
    if (!parsed) {
      setQuery(formatTimeLabel(canonicalValue))
      close()
      return
    }
    const resolved = minuteStep === 1 ? parsed : snapTimeToStep(parsed, minuteStep)
    if (!resolved) return
    onChange(resolved)
    setQuery(formatTimeLabel(resolved))
    close()
  }

  const moveActive = (offset: number) => {
    setOpen(true)
    setDirty(true)
    setActiveIndex((current) => (current + offset + suggestions.length) % suggestions.length)
  }

  const selectedByKeyboard = () => activeIndex === 0 ? undefined : active?.value

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit(selectedByKeyboard())
    } else if (event.key === 'Tab') {
      commit(selectedByKeyboard())
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setQuery(formatTimeLabel(canonicalValue))
      close()
    }
  }

  const listboxId = `${id || name || `smart-time-${generatedId}`}-options`

  return (
    <div className={`relative ${className}`}>
      <Clock3 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-dash-tertiary" size={17} />
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={open && active ? `${listboxId}-${active.value.replace(':', '')}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        value={query}
        placeholder={placeholder}
        onFocus={(event) => {
          setOpen(true)
          setDirty(false)
          requestAnimationFrame(() => event.currentTarget.select())
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setDirty(true)
          setActiveIndex(0)
          setOpen(true)
        }}
        onBlur={() => commit(selectedByKeyboard())}
        onKeyDown={handleKeyDown}
        className={`w-full rounded-xl border border-white/10 bg-white/[0.035] py-3 pl-10 pr-3 text-sm text-dash-cream outline-none transition placeholder:text-dash-tertiary focus:border-dash-gold/70 disabled:cursor-not-allowed disabled:opacity-50 ${inputClassName}`}
      />
      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          style={menuPosition}
          className="fixed z-[10000] overflow-y-auto rounded-lg border border-dash-border bg-dash-elevated p-1.5 shadow-2xl"
        >
          {suggestions.map((option, index) => {
            const selected = option.value === canonicalValue
            const highlighted = index === activeIndex
            return (
              <button
                key={option.value}
                ref={(element) => {
                  if (element) optionRefs.current.set(option.value, element)
                  else optionRefs.current.delete(option.value)
                }}
                id={`${listboxId}-${option.value.replace(':', '')}`}
                type="button"
                role="option"
                aria-selected={highlighted}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(option.value)}
                className={`flex min-h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm transition ${highlighted ? 'bg-dash-gold/15 text-dash-cream' : 'text-dash-secondary hover:bg-white/[0.06] hover:text-dash-cream'}`}
              >
                <span>{option.label}</span>
                {selected && <Check aria-hidden="true" size={15} className="text-dash-gold" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
