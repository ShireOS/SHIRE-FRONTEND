import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeCategoryOptionLabel } from '../menuCategoryOptions.js'

export interface CreatableComboboxOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface CreatableComboboxProps {
  value: string
  options: CreatableComboboxOption[]
  onChange: (value: string) => void
  onCreate?: (label: string) => string | void | Promise<string | void>
  ariaLabel: string
  createNoun?: string
  disabled?: boolean
  inherited?: boolean
  placeholder?: string
  className?: string
}

export function CreatableCombobox({
  value,
  options,
  onChange,
  onCreate,
  ariaLabel,
  createNoun = 'option',
  disabled = false,
  inherited = false,
  placeholder = 'Choose an option',
  className = '',
}: CreatableComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const selected = options.find(option => option.value === value)
  const normalizedQuery = normalizeCategoryOptionLabel(query)
  const filtered = useMemo(() => {
    const key = normalizedQuery.toLocaleLowerCase()
    return key
      ? options.filter(option => `${option.label} ${option.description || ''}`.toLocaleLowerCase().includes(key))
      : options
  }, [normalizedQuery, options])
  const exactMatch = options.some(option => option.label.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase())
  const canCreate = Boolean(onCreate && normalizedQuery && !exactMatch)

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsidePress)
    return () => document.removeEventListener('mousedown', closeOnOutsidePress)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const choose = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
    setCreateError('')
  }

  const create = async () => {
    if (!onCreate || !canCreate) return
    setCreating(true)
    setCreateError('')
    try {
      const nextValue = await onCreate(normalizedQuery)
      if (typeof nextValue === 'string') choose(nextValue)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : `Could not create ${createNoun}.`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          setOpen(current => !current)
          setCreateError('')
        }}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-sm outline-none transition focus:border-[rgba(212,168,84,0.7)] focus:ring-2 focus:ring-[rgba(212,168,84,0.35)] disabled:opacity-50"
      >
        <span className={`min-w-0 truncate ${inherited ? 'text-[rgb(var(--text-tertiary))]' : 'text-[rgb(var(--text-primary))]'}`}>
          {selected?.label || (value ? value : placeholder)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[rgb(var(--text-tertiary))] transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-xl border border-white/15 bg-[#171714] shadow-2xl">
          <div className="border-b border-white/10 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') setOpen(false)
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (filtered.length === 1 && !canCreate) choose(filtered[0].value)
                  else if (canCreate) void create()
                }
              }}
              placeholder={`Search ${createNoun}s…`}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-[rgba(212,168,84,0.7)]"
            />
          </div>
          <div role="listbox" aria-label={ariaLabel} className="max-h-60 overflow-y-auto p-1.5">
            {filtered.map(option => (
              <button
                key={`${option.value}:${option.label}`}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled || creating}
                onClick={() => choose(option.value)}
                className={`w-full rounded-lg px-3 py-2 text-left transition disabled:opacity-40 ${option.value === value ? 'bg-[rgba(212,168,84,0.16)]' : 'hover:bg-white/[0.06]'}`}
              >
                <span className={`block text-sm ${option.value ? 'text-white' : 'text-white/50'}`}>{option.label}</span>
                {option.description && <span className="mt-0.5 block text-xs text-white/40">{option.description}</span>}
              </button>
            ))}
            {!filtered.length && !canCreate && <p className="px-3 py-3 text-sm text-white/45">No matches</p>}
          </div>
          {canCreate && (
            <div className="border-t border-white/10 p-1.5">
              <button
                type="button"
                disabled={creating}
                onClick={() => void create()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#d4a854] transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {creating ? `Creating ${createNoun}…` : `Create “${normalizedQuery}”`}
              </button>
            </div>
          )}
          {createError && <p role="alert" className="border-t border-red-400/20 px-3 py-2 text-xs text-red-300">{createError}</p>}
        </div>
      )}
    </div>
  )
}
