import { useRef, useState, useCallback, useEffect } from 'react'

export interface FloorPlanTable {
  id: string
  center_x: number
  center_y: number
  width: number
  height: number
  capacity: number
  shape: 'rectangular'
  confidence?: number
  notes?: string
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

type DragState =
  | { type: 'move'; id: string; startMousePct: { x: number; y: number }; startCenter: { x: number; y: number } }
  | { type: 'resize'; id: string; handle: ResizeHandle; startMousePct: { x: number; y: number }; startTable: FloorPlanTable }

interface FloorPlanCanvasProps {
  tables: FloorPlanTable[]
  onTablesChange: (tables: FloorPlanTable[]) => void
  backgroundImage?: string
  mode: 'upload' | 'manual'
}

const MIN_SIZE = 5
const MAX_SIZE = 50
const HANDLE_SIZE = 10 // px

export function FloorPlanCanvas({ tables, onTablesChange, backgroundImage, mode }: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingCapacity, setEditingCapacity] = useState<string>('')
  // Use ref for drag state so native event handlers always see the current value
  const dragRef = useRef<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Keep latest tables/callback in refs so registered-once handlers can access them
  const tablesRef = useRef(tables)
  const onChangeRef = useRef(onTablesChange)
  useEffect(() => { tablesRef.current = tables }, [tables])
  useEffect(() => { onChangeRef.current = onTablesChange }, [onTablesChange])

  const selectedTable = tables.find(t => t.id === selectedId) ?? null
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

  const clampTable = (t: FloorPlanTable): FloorPlanTable => {
    const w = Math.max(MIN_SIZE, Math.min(MAX_SIZE, t.width))
    const h = Math.max(MIN_SIZE, Math.min(MAX_SIZE, t.height))
    const cx = Math.max(w / 2, Math.min(100 - w / 2, t.center_x))
    const cy = Math.max(h / 2, Math.min(100 - h / 2, t.center_y))
    return { ...t, width: w, height: h, center_x: cx, center_y: cy }
  }

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
        onChangeRef.current(current.map(t =>
          t.id !== drag.id ? t : clampTable({ ...t, center_x: drag.startCenter.x + dx, center_y: drag.startCenter.y + dy })
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
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [toPct]) // toPct is stable (useCallback with no deps that change)

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
        t.id === selectedId ? { ...t, capacity: Math.min(20, Math.max(1, val)) } : t
      ))
    }
  }

  const deleteSelected = () => {
    if (!selectedId) return
    onTablesChange(tables.filter(t => t.id !== selectedId))
    setSelectedId(null)
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
          aspectRatio: '4/3',
          cursor: isDragging ? 'grabbing' : 'default',
          position: 'relative',
        }}
        // No overflow-hidden — handles need to poke outside
        className="w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] select-none"
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
            <p className="text-[rgb(var(--text-tertiary))] text-sm">Click "+ Add Table" below to place tables</p>
          </div>
        )}

        {/* Tables */}
        {tables.map((table, idx) => {
          const isSelected = table.id === selectedId
          const isHovered = table.id === hoveredId
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
                    : '2px solid rgba(201,169,98,0.7)',
                  background: isSelected
                    ? 'rgba(201,169,98,0.25)'
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
                  T{idx + 1}
                </span>
                <span style={{
                  fontSize: 9, color: '#fff', lineHeight: 1, marginTop: 2,
                  background: 'rgba(0,0,0,0.5)', borderRadius: 3, padding: '1px 3px',
                }}>
                  {table.capacity}p
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
                    gap: 6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    minWidth: 130,
                    whiteSpace: 'nowrap',
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
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteSelected() }}
                    style={{ fontSize: 13, color: 'rgb(var(--text-tertiary))', cursor: 'pointer', padding: '0 2px' }}
                    title="Delete table"
                  >
                    ✕
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
