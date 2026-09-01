import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import { collapseEntryWhitespace, duplicateName, sanitizeCountInput } from '@shire/settings'
import type { FloorPlanSection, FloorPlanTable } from './FloorPlanCanvas'

interface FloorPlanTableSetupProps {
  restaurantId: string
  tables: FloorPlanTable[]
  onTablesChange: (tables: FloorPlanTable[]) => void
  onSaved?: (tables: FloorPlanTable[]) => void
}

const getToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : ''
}

const hasRequiredTableFields = (table: FloorPlanTable) =>
  Boolean(table.table_number?.trim())
  && Number.isInteger(Number(table.capacity))
  && Number(table.capacity) >= 1
  && Number(table.capacity) <= 20

const isTableComplete = (table: FloorPlanTable) =>
  hasRequiredTableFields(table)

const missingTableDetails = (table: FloorPlanTable) => {
  const missing: string[] = []
  if (!table.table_number?.trim()) missing.push('number')
  if (!(Number(table.capacity) > 0)) missing.push('seats')
  return missing
}

const normalizeTable = (table: FloorPlanTable): FloorPlanTable => ({
  ...table,
  table_number: table.table_number ?? '',
  capacity: Number(table.capacity) > 0 ? Number(table.capacity) : 0,
  section_name: table.section_name || 'Table',
  setup_complete: hasRequiredTableFields(table),
})

export function floorPlanIncompleteCount(tables: FloorPlanTable[]) {
  return tables.filter(table => !isTableComplete(table)).length
}

export function floorPlanEntryError(tables: FloorPlanTable[]) {
  const names = tables.map(table => collapseEntryWhitespace(table.table_number))
  const duplicateIndex = names.findIndex((name, index) => name && duplicateName(names, name, index))
  if (duplicateIndex >= 0) return `Table “${names[duplicateIndex]}” appears more than once.`
  const longName = names.find(name => name.length > 20)
  if (longName) return 'Table numbers can contain at most 20 characters.'
  const invalidCapacity = tables.find(table => table.capacity && !hasRequiredTableFields({ ...table, table_number: table.table_number || 'table' }))
  if (invalidCapacity) return 'Table seats must be a whole number from 1 to 20.'
  return ''
}

export function FloorPlanTableSetup({ restaurantId, tables, onTablesChange, onSaved }: FloorPlanTableSetupProps) {
  const [sections, setSections] = useState<FloorPlanSection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(tables[0]?.id ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    const loadSections = async () => {
      const token = await getToken()
      const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/sections`, {
        headers: { Authorization: token },
      }).catch(() => null)
      if (!response?.ok) return
      const rows = await response.json().catch(() => [])
      if (!cancelled && Array.isArray(rows)) {
        setSections(rows.map((row: any) => ({ id: row.id, name: row.name })).filter((row: FloorPlanSection) => row.id && row.name))
      }
    }
    void loadSections()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const normalizedTables = useMemo(() => tables.map(normalizeTable), [tables])
  const incompleteCount = floorPlanIncompleteCount(normalizedTables)

  const updateTable = (id: string, patch: Partial<FloorPlanTable>) => {
    onTablesChange(tables.map(table => {
      if (table.id !== id) return table
      const section = patch.section_id !== undefined
        ? sections.find(item => item.id === patch.section_id)
        : null
      const nextTable = {
        ...table,
        ...patch,
        ...(patch.section_id !== undefined
          ? { section_name: section?.name || '' }
          : {}),
      }
      return { ...normalizeTable(nextTable), setup_complete: hasRequiredTableFields(nextTable) }
    }))
  }

  const saveTables = async () => {
    if (!restaurantId) return
    setIsSaving(true)
    setMessage('Saving table setup...')
    try {
      const prepared = tables.map(normalizeTable)
      const entryError = floorPlanEntryError(prepared)
      if (entryError) throw new Error(entryError)
      const token = await getToken()
      const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/floor-plan/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          image_url: null,
          tables: prepared.map(table => ({
            id: table.id,
            table_number: table.table_number?.trim() || null,
            position: { center_x: table.center_x, center_y: table.center_y, width: table.width, height: table.height },
            shape: table.shape,
            capacity: Number(table.capacity) || 0,
            section_id: table.section_id || null,
            section_name: table.section_name || null,
            setup_complete: hasRequiredTableFields(table),
            confidence: table.confidence,
            notes: table.notes,
          })),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || body.message || `Save failed (${response.status})`)
      }
      onTablesChange(prepared)
      onSaved?.(prepared)
      const remaining = floorPlanIncompleteCount(prepared)
      setMessage(remaining > 0 ? `${remaining} table${remaining === 1 ? '' : 's'} need details.` : 'All tables saved and complete.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save table setup.')
    } finally {
      setIsSaving(false)
    }
  }

  if (tables.length === 0) return null

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Table numbers, seats, and sections</p>
          <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">
            Assign each table to the section it belongs to, such as Bar, Patio, Outdoor, or Main Dining. Blank sections save as Table.
          </p>
        </div>
        <span className={incompleteCount > 0 ? 'text-xs font-semibold text-red-300' : 'text-xs font-semibold text-emerald-300'}>
          {incompleteCount > 0 ? `${incompleteCount} need details` : 'Complete'}
        </span>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)]">
        {normalizedTables.map((table, index) => {
          const incomplete = !isTableComplete(table)
          const selected = table.id === selectedId
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelectedId(table.id)}
              className={[
                'absolute flex flex-col items-center justify-center rounded-md border text-[10px] font-bold text-white transition',
                incomplete ? 'border-red-300 bg-red-900/60' : 'border-[rgb(var(--gold))]/70 bg-black/40',
                selected ? 'ring-2 ring-white/80' : '',
              ].join(' ')}
              style={{
                left: `${table.center_x - table.width / 2}%`,
                top: `${table.center_y - table.height / 2}%`,
                width: `${table.width}%`,
                height: `${table.height}%`,
              }}
            >
              <span>{table.table_number?.trim() || `T${index + 1}`}</span>
              <span className="font-medium opacity-80">{Number(table.capacity) > 0 ? `${table.capacity}p` : 'Seats?'}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        <div className="hidden gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--text-tertiary))] md:grid md:grid-cols-[1fr_1fr_120px_auto]">
          <span>Table</span>
          <span>Section</span>
          <span>Seats</span>
          <span>Status</span>
        </div>
        {normalizedTables.map((table, index) => {
          const incomplete = !isTableComplete(table)
          const missing = missingTableDetails(table)
          return (
            <div
              key={table.id}
              className={[
                'grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_120px_auto]',
                incomplete ? 'border-red-400/40 bg-red-500/10' : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]',
              ].join(' ')}
            >
              <input
                value={table.table_number || ''}
                onFocus={() => setSelectedId(table.id)}
                onChange={event => updateTable(table.id, { table_number: event.target.value })}
                maxLength={20}
                placeholder={`Table ${index + 1}`}
                className="min-h-[40px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 text-sm text-[rgb(var(--text-primary))] outline-none"
              />
              <select
                value={table.section_id || ''}
                onFocus={() => setSelectedId(table.id)}
                onChange={event => updateTable(table.id, { section_id: event.target.value || null })}
                className="min-h-[40px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 text-sm text-[rgb(var(--text-primary))] outline-none"
              >
                <option value="" className="bg-[#1a1a1a]">Assign section</option>
                {sections.map(section => (
                  <option key={section.id} value={section.id} className="bg-[#1a1a1a]">{section.name}</option>
                ))}
              </select>
              <input
                value={Number(table.capacity) > 0 ? String(table.capacity) : ''}
                onFocus={() => setSelectedId(table.id)}
                onChange={event => updateTable(table.id, { capacity: Number(sanitizeCountInput(event.target.value, 2) || 0) })}
                inputMode="numeric"
                min={1}
                max={20}
                placeholder="Seats"
                className="min-h-[40px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 text-sm text-[rgb(var(--text-primary))] outline-none"
              />
              <span className={incomplete ? 'self-center text-xs font-semibold text-red-300' : 'self-center text-xs font-semibold text-emerald-300'}>
                {incomplete ? `Needs ${missing.join(' and ')}` : 'Ready'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={saveTables}
          disabled={isSaving}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save table setup'}
        </button>
        {message ? <span className="text-xs text-[rgb(var(--text-tertiary))]">{message}</span> : null}
      </div>
    </div>
  )
}
