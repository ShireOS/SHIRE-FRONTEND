import { useRef, useState, useCallback, useEffect } from 'react'

export interface FloorPlanTable {
  id: string
  table_number?: string | null
  center_x: number
  center_y: number
  width: number
  height: number
  capacity: number
  shape: 'rectangular'
  section_id?: string | null
  section_name?: string | null
  setup_complete?: boolean
  confidence?: number
  notes?: string
}

export interface FloorPlanSection {
  id: string
  name: string
}

export function normalizeFloorPlanTablesForEditor(tables: FloorPlanTable[], padding = 6): FloorPlanTable[] {
  if (!Array.isArray(tables) || tables.length === 0) return []

  const extents = tables.reduce(
    (acc, table) => {
      const width = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number(table.width || 12)))
      const height = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number(table.height || 10)))
      const left = Number(table.center_x || 50) - width / 2
      const right = Number(table.center_x || 50) + width / 2
      const top = Number(table.center_y || 50) - height / 2
      const bottom = Number(table.center_y || 50) + height / 2
      return {
        minX: Math.min(acc.minX, left),
        maxX: Math.max(acc.maxX, right),
        minY: Math.min(acc.minY, top),
        maxY: Math.max(acc.maxY, bottom),
      }
    },
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  )

  if (!Number.isFinite(extents.minX) || !Number.isFinite(extents.minY)) return tables

  const sourceWidth = Math.max(1, extents.maxX - extents.minX)
  const sourceHeight = Math.max(1, extents.maxY - extents.minY)
  const targetSize = 100 - padding * 2
  const scale = Math.min(targetSize / sourceWidth, targetSize / sourceHeight, 1.15)
  const fittedWidth = sourceWidth * scale
  const fittedHeight = sourceHeight * scale
  const offsetX = padding + (targetSize - fittedWidth) / 2
  const offsetY = padding + (targetSize - fittedHeight) / 2

  return tables.map(table => {
    const width = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number(table.width || 12))) * scale
    const height = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number(table.height || 10))) * scale
    return {
      ...table,
      center_x: offsetX + (Number(table.center_x || 50) - extents.minX) * scale,
      center_y: offsetY + (Number(table.center_y || 50) - extents.minY) * scale,
      width: Math.max(MIN_SIZE, Math.min(MAX_SIZE, width)),
      height: Math.max(MIN_SIZE, Math.min(MAX_SIZE, height)),
    }
  })
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'
type AlignmentGuide = { orientation: 'vertical' | 'horizontal'; position: number }

type DragState =
  | { type: 'move'; id: string; startMousePct: { x: number; y: number }; startCenter: { x: number; y: number } }
  | { type: 'resize'; id: string; handle: ResizeHandle; startMousePct: { x: number; y: number }; startTable: FloorPlanTable }

interface FloorPlanCanvasProps {
  tables: FloorPlanTable[]
  onTablesChange: (tables: FloorPlanTable[]) => void
  sections?: FloorPlanSection[]
  backgroundImage?: string
  mode: 'upload' | 'manual'
}

const MIN_SIZE = 5
const MAX_SIZE = 50
const HANDLE_SIZE = 10 // px
const DUPLICATE_OFFSET = 5
const ALIGN_THRESHOLD = 1.2

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const makeTableId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `table-${Date.now()}-${Math.random().toString(36).slice(2)}`
const tableHasSetupDetails = (table: FloorPlanTable) =>
  Boolean(table.table_number?.trim()) && Number(table.capacity) > 0
const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable
}
const nextTableNumber = (tables: FloorPlanTable[], preferred?: string | null) => {
  const used = new Set(tables.map(table => table.table_number?.trim()).filter(Boolean))
  const preferredNumber = Number.parseInt(preferred || '', 10)
  let next = Number.isFinite(preferredNumber) && preferredNumber > 0 ? preferredNumber + 1 : tables.length + 1
  while (used.has(String(next))) next += 1
  return String(next)
}

export function FloorPlanCanvas({ tables, onTablesChange, sections = [], backgroundImage, mode }: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingCapacity, setEditingCapacity] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState('')
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([])
  const copiedTableRef = useRef<FloorPlanTable | null>(null)
  const statusTimeoutRef = useRef<number | null>(null)
  // Use ref for drag state so native event handlers always see the current value
  const dragRef = useRef<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Keep latest tables/callback in refs so registered-once handlers can access them
  const tablesRef = useRef(tables)
  const onChangeRef = useRef(onTablesChange)
  useEffect(() => { tablesRef.current = tables }, [tables])
  useEffect(() => { onChangeRef.current = onTablesChange }, [onTablesChange])

  const selectedTable = tables.find(t => t.id === selectedId) ?? null
  const defaultSection = sections.find(section => section.name.toLowerCase() === 'table') ?? sections[0] ?? null
  useEffect(() => {
    if (selectedTable) setEditingCapacity(String(selectedTable.capacity))
  }, [selectedId]) // intentionally only on selectedId change

  const toPct = useCallback((e: MouseEvent): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message)
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current)
    statusTimeoutRef.current = window.setTimeout(() => setStatusMessage(''), 1600)
  }, [])

  useEffect(() => () => {
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current)
  }, [])

  const clampTable = (t: FloorPlanTable): FloorPlanTable => {
    const w = clamp(t.width, MIN_SIZE, MAX_SIZE)
    const h = clamp(t.height, MIN_SIZE, MAX_SIZE)
    const cx = clamp(t.center_x, w / 2, 100 - w / 2)
    const cy = clamp(t.center_y, h / 2, 100 - h / 2)
    return { ...t, width: w, height: h, center_x: cx, center_y: cy }
  }

  const alignToNearbyTables = (table: FloorPlanTable, allTables: FloorPlanTable[]) => {
    const others = allTables.filter(item => item.id !== table.id)
    if (others.length === 0) return { table, guides: [] as AlignmentGuide[] }

    const xAnchors = [
      { key: 'left', value: table.center_x - table.width / 2 },
      { key: 'center', value: table.center_x },
      { key: 'right', value: table.center_x + table.width / 2 },
    ]
    const yAnchors = [
      { key: 'top', value: table.center_y - table.height / 2 },
      { key: 'middle', value: table.center_y },
      { key: 'bottom', value: table.center_y + table.height / 2 },
    ]
    const candidates = others.flatMap(other => {
      const otherX = [
        { key: 'left', value: other.center_x - other.width / 2 },
        { key: 'center', value: other.center_x },
        { key: 'right', value: other.center_x + other.width / 2 },
      ]
      const otherY = [
        { key: 'top', value: other.center_y - other.height / 2 },
        { key: 'middle', value: other.center_y },
        { key: 'bottom', value: other.center_y + other.height / 2 },
      ]
      return [
        ...xAnchors.flatMap(source => otherX.map(target => ({ axis: 'x' as const, distance: Math.abs(source.value - target.value), delta: target.value - source.value, position: target.value }))),
        ...yAnchors.flatMap(source => otherY.map(target => ({ axis: 'y' as const, distance: Math.abs(source.value - target.value), delta: target.value - source.value, position: target.value }))),
      ]
    })

    const xMatch = candidates
      .filter(candidate => candidate.axis === 'x' && candidate.distance <= ALIGN_THRESHOLD)
      .sort((a, b) => a.distance - b.distance)[0]
    const yMatch = candidates
      .filter(candidate => candidate.axis === 'y' && candidate.distance <= ALIGN_THRESHOLD)
      .sort((a, b) => a.distance - b.distance)[0]

    const aligned = clampTable({
      ...table,
      center_x: table.center_x + (xMatch?.delta ?? 0),
      center_y: table.center_y + (yMatch?.delta ?? 0),
    })

    return {
      table: aligned,
      guides: [
        ...(xMatch ? [{ orientation: 'vertical' as const, position: xMatch.position }] : []),
        ...(yMatch ? [{ orientation: 'horizontal' as const, position: yMatch.position }] : []),
      ],
    }
  }

  const duplicateTable = useCallback((source: FloorPlanTable, currentTables: FloorPlanTable[]) => {
    const tableNumber = nextTableNumber(currentTables, source.table_number)
    const duplicated = clampTable({
      ...source,
      id: makeTableId(),
      table_number: tableNumber,
      center_x: source.center_x + DUPLICATE_OFFSET,
      center_y: source.center_y + DUPLICATE_OFFSET,
      setup_complete: true,
    })
    const next = [...currentTables, { ...duplicated, setup_complete: tableHasSetupDetails(duplicated) }]
    onChangeRef.current(next)
    tablesRef.current = next
    setSelectedId(duplicated.id)
    showStatus(`Copied table ${source.table_number?.trim() || 'table'} to ${tableNumber}`)
  }, [showStatus])

  // Register mouse move/up once — read from refs to avoid stale closures
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const mouse = toPct(e)
      const current = tablesRef.current

      if (drag.type === 'move') {
        const dx = mouse.x - drag.startMousePct.x
        const dy = mouse.y - drag.startMousePct.y
        const activeTable = current.find(t => t.id === drag.id)
        if (!activeTable) return
        const proposed = clampTable({ ...activeTable, center_x: drag.startCenter.x + dx, center_y: drag.startCenter.y + dy })
        const aligned = alignToNearbyTables(proposed, current)
        setAlignmentGuides(aligned.guides)
        onChangeRef.current(current.map(t =>
          t.id !== drag.id ? t : aligned.table
        ))
      }

      if (drag.type === 'resize') {
        const dx = mouse.x - drag.startMousePct.x
        const dy = mouse.y - drag.startMousePct.y
        const st = drag.startTable
        let { center_x, center_y, width, height } = st

        if (drag.handle === 'nw') {
          width = st.width - dx * 2; height = st.height - dy * 2
          center_x = st.center_x + dx; center_y = st.center_y + dy
        } else if (drag.handle === 'ne') {
          width = st.width + dx * 2; height = st.height - dy * 2
          center_y = st.center_y + dy
        } else if (drag.handle === 'sw') {
          width = st.width - dx * 2; height = st.height + dy * 2
          center_x = st.center_x + dx
        } else if (drag.handle === 'se') {
          width = st.width + dx * 2; height = st.height + dy * 2
        }

        onChangeRef.current(current.map(t =>
          t.id !== drag.id ? t : clampTable({ ...t, center_x, center_y, width, height })
        ))
      }
    }

    const handleMouseUp = () => {
      dragRef.current = null
      setIsDragging(false)
      setAlignmentGuides([])
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [toPct]) // toPct is stable (useCallback with no deps that change)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const current = tablesRef.current
      const selected = selectedId ? current.find(table => table.id === selectedId) ?? null : null
      const isShortcut = event.metaKey || event.ctrlKey

      if (isShortcut && event.key.toLowerCase() === 'c' && selected) {
        event.preventDefault()
        copiedTableRef.current = { ...selected }
        showStatus(`Copied table ${selected.table_number?.trim() || 'table'}`)
        return
      }

      if (isShortcut && event.key.toLowerCase() === 'v') {
        const source = copiedTableRef.current ?? selected
        if (!source) return
        event.preventDefault()
        duplicateTable(source, current)
        return
      }

      if (isShortcut && event.key.toLowerCase() === 'd' && selected) {
        event.preventDefault()
        copiedTableRef.current = { ...selected }
        duplicateTable(selected, current)
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
        event.preventDefault()
        const next = current.filter(table => table.id !== selected.id)
        onChangeRef.current(next)
        tablesRef.current = next
        setSelectedId(null)
        showStatus(`Removed table ${selected.table_number?.trim() || 'table'}`)
        return
      }

      if (event.key === 'Escape') setSelectedId(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [duplicateTable, selectedId, showStatus])

  const startMove = (e: React.MouseEvent, table: FloorPlanTable) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(table.id)
    dragRef.current = {
      type: 'move',
      id: table.id,
      startMousePct: toPct(e.nativeEvent),
      startCenter: { x: table.center_x, y: table.center_y },
    }
    setIsDragging(true)
  }

  const startResize = (e: React.MouseEvent, table: FloorPlanTable, handle: ResizeHandle) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(table.id)
    dragRef.current = {
      type: 'resize',
      id: table.id,
      handle,
      startMousePct: toPct(e.nativeEvent),
      startTable: { ...table },
    }
    setIsDragging(true)
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on the canvas background
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvasBg) {
      setSelectedId(null)
    }
  }

  const commitCapacity = () => {
    const val = parseInt(editingCapacity, 10)
    if (!isNaN(val) && val >= 1 && selectedId) {
      onTablesChange(tables.map(t =>
        t.id === selectedId
          ? {
              ...t,
              capacity: Math.min(20, Math.max(1, val)),
              setup_complete: tableHasSetupDetails({ ...t, capacity: val }),
            }
          : t
      ))
    }
  }

  const deleteSelected = () => {
    if (!selectedId) return
    onTablesChange(tables.filter(t => t.id !== selectedId))
    setSelectedId(null)
  }

  const updateSelectedSection = (sectionId: string) => {
    if (!selectedId) return
    const section = sections.find(item => item.id === sectionId) ?? defaultSection
    onTablesChange(tables.map(table =>
      table.id === selectedId
        ? {
            ...table,
            section_id: section?.id ?? null,
            section_name: section?.name ?? 'Table',
            setup_complete: tableHasSetupDetails(table),
          }
        : table
    ))
  }

  const gridStyle = mode === 'manual' ? {
    backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
    backgroundSize: '5% 5%',
  } : {}

  const handlePositions: Record<ResizeHandle, React.CSSProperties> = {
    nw: { top: 0, left: 0, transform: 'translate(-50%, -50%)', cursor: 'nw-resize' },
    ne: { top: 0, right: 0, transform: 'translate(50%, -50%)', cursor: 'ne-resize' },
    sw: { bottom: 0, left: 0, transform: 'translate(-50%, 50%)', cursor: 'sw-resize' },
    se: { bottom: 0, right: 0, transform: 'translate(50%, 50%)', cursor: 'se-resize' },
  }

  return (
    // Outer wrapper: no overflow-hidden so resize handles can extend outside canvas
    <div className="relative w-full">
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          ...gridStyle,
          aspectRatio: '1000 / 680',
          cursor: isDragging ? 'grabbing' : 'default',
          position: 'relative',
        }}
        // No overflow-hidden — handles need to poke outside
        className="min-h-[360px] w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] select-none md:min-h-[540px]"
      >
        {/* Background image clipped separately */}
        {backgroundImage && (
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            <img
              src={backgroundImage}
              alt="Floor plan"
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* Subtle canvas boundary for manual mode (not overflow-hidden, just visual) */}
        {mode === 'manual' && (
          <div data-canvas-bg="true" className="absolute inset-0 rounded-xl" />
        )}

        {/* Empty state */}
        {tables.length === 0 && mode === 'manual' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[rgb(var(--text-tertiary))] text-sm">Click Add Table below, then drag or use Command V to place copies</p>
          </div>
        )}

        {statusMessage && (
          <div className="pointer-events-none absolute left-3 top-3 z-[70] rounded-md border border-white/10 bg-black/75 px-3 py-2 text-xs font-medium text-white shadow-lg">
            {statusMessage}
          </div>
        )}

        {alignmentGuides.map((guide, index) => (
          <div
            key={`${guide.orientation}-${guide.position}-${index}`}
            className="pointer-events-none absolute z-[65] bg-[rgb(var(--gold))]/80 shadow-[0_0_10px_rgba(201,169,98,0.5)]"
            style={guide.orientation === 'vertical'
              ? { left: `${guide.position}%`, top: 0, bottom: 0, width: 1 }
              : { top: `${guide.position}%`, left: 0, right: 0, height: 1 }}
          />
        ))}

        {/* Tables */}
        {tables.map((table, idx) => {
          const isSelected = table.id === selectedId
          const isHovered = table.id === hoveredId
          const sectionLabel = table.section_name || defaultSection?.name || 'Table'
          const isIncomplete = !tableHasSetupDetails(table)
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${table.center_x - table.width / 2}%`,
            top: `${table.center_y - table.height / 2}%`,
            width: `${table.width}%`,
            height: `${table.height}%`,
            zIndex: isSelected ? 20 : isHovered ? 15 : 10,
          }

          return (
            <div
              key={table.id}
              style={style}
              onMouseEnter={() => setHoveredId(table.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Table body — stop click from bubbling to canvas */}
              <div
                onMouseDown={(e) => startMove(e, table)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  inset: 0,
                  cursor: isDragging && dragRef.current?.id === table.id ? 'grabbing' : 'grab',
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isSelected
                    ? '2px solid rgb(201,169,98)'
                    : isIncomplete
                      ? '2px solid rgba(248,113,113,0.95)'
                      : '2px solid rgba(201,169,98,0.7)',
                  background: isSelected
                    ? 'rgba(201,169,98,0.25)'
                    : isIncomplete
                      ? 'rgba(127,29,29,0.52)'
                    : 'rgba(0,0,0,0.35)',
                  transition: 'background 0.15s, border-color 0.15s',
                  userSelect: 'none',
                }}
              >
                {/* Label pill — always legible over any background */}
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1,
                  background: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '1px 4px',
                }}>
                  {table.table_number?.trim() || `T${idx + 1}`}
                </span>
                <span style={{
                  fontSize: 9, color: '#fff', lineHeight: 1, marginTop: 2,
                  background: 'rgba(0,0,0,0.5)', borderRadius: 3, padding: '1px 3px',
                }}>
                  {table.capacity}p
                </span>
                <span style={{
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 8,
                  color: '#fff',
                  lineHeight: 1,
                  marginTop: 2,
                  background: 'rgba(0,0,0,0.45)',
                  borderRadius: 3,
                  padding: '1px 3px',
                }}>
                  {sectionLabel}
                </span>
              </div>

              {/* Resize handles — rendered when selected or hovered, positioned at corners */}
              {(isSelected || isHovered) && ((['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map(handle => (
                <div
                  key={handle}
                  onMouseDown={(e) => startResize(e, table, handle)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    background: 'rgb(var(--gold))',
                    border: '2px solid rgba(0,0,0,0.4)',
                    borderRadius: 2,
                    zIndex: 30,
                    ...handlePositions[handle],
                  }}
                />
              )))}

              {/* Edit popover */}
              {isSelected && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 50,
                    background: 'rgb(var(--bg-elevated))',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    minWidth: 190,
                    maxWidth: 260,
                  }}
                >
                  <span style={{ fontSize: 11, color: 'rgb(var(--text-tertiary))' }}>Seats:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editingCapacity}
                    onChange={(e) => setEditingCapacity(e.target.value)}
                    onBlur={commitCapacity}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitCapacity() }}
                    style={{
                      width: 44,
                      padding: '2px 6px',
                      fontSize: 12,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      color: 'rgb(var(--text-primary))',
                      outline: 'none',
                    }}
                  />
                  {sections.length > 0 && (
                    <>
                      <span style={{ fontSize: 11, color: 'rgb(var(--text-tertiary))' }}>Section:</span>
                      <select
                        value={selectedTable?.section_id || defaultSection?.id || ''}
                        onChange={(e) => updateSelectedSection(e.target.value)}
                        style={{
                          minWidth: 96,
                          maxWidth: 140,
                          padding: '2px 6px',
                          fontSize: 12,
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 4,
                          color: 'rgb(var(--text-primary))',
                          outline: 'none',
                        }}
                      >
                        {sections.map(section => (
                          <option key={section.id} value={section.id}>{section.name}</option>
                        ))}
                      </select>
                    </>
                  )}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      copiedTableRef.current = selectedTable ? { ...selectedTable } : null
                      if (selectedTable) duplicateTable(selectedTable, tables)
                    }}
                    style={{
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 5,
                      color: 'rgb(var(--text-secondary))',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '3px 7px',
                    }}
                    title="Duplicate table"
                  >
                    Copy
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteSelected() }}
                    style={{
                      border: '1px solid rgba(248,113,113,0.35)',
                      borderRadius: 5,
                      color: 'rgb(252,165,165)',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '3px 7px',
                    }}
                    title="Delete table"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
