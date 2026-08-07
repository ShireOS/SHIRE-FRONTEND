import { useEffect, useRef, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { autoScrollVelocity, findScrollableAncestor } from './autoScroll'

const sameOrder = (a, b) => a.length === b.length && a.every((id, index) => id === b[index])
const sameMembers = (a, b) => a.length === b.length && a.every(id => b.includes(id))

// Drag-to-reorder vertical list. `renderRow(id, { handleProps, isDragging })`
// renders each row; spread `handleProps` onto the element that should act as
// the grip (usually a <DragHandle/>). `onReorder` receives the full id array
// in its new order — persist it there and return the save promise.
//
// Rendering is optimistic: the dropped order shows immediately while the save
// runs, so rows don't snap back to the old order until the refetch lands. The
// list re-syncs to `ids` once the parent adopts the new order, when rows are
// added/removed, or when a returned save promise settles without the parent
// catching up (failed save → revert to source of truth).
export function SortableRows({ ids, onReorder, disabled = false, className, renderRow }) {
  const [localIds, setLocalIds] = useState(ids)
  const pendingRef = useRef(null) // dropped order the parent hasn't adopted yet
  const idsRef = useRef(ids)
  idsRef.current = ids

  useEffect(() => {
    const pending = pendingRef.current
    if (pending) {
      if (sameOrder(ids, pending)) {
        pendingRef.current = null
        return
      }
      if (sameMembers(ids, pending)) return // stale order mid-save — keep the optimistic one
      pendingRef.current = null // rows added or removed — parent wins
    }
    setLocalIds(current => (sameOrder(current, ids) ? current : ids))
  }, [ids])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Pointer-edge auto-scroll (dnd-kit's built-in scroller is disabled below —
  // it keys off the clamped drag rect, which restrictToParentElement can pin
  // away from the viewport edge, so long lists never scrolled). While a drag
  // is active, holding the pointer near the top/bottom of the scroll viewport
  // scrolls the nearest scrollable ancestor — or the page — under the drag.
  const containerRef = useRef(null)
  const autoScrollStateRef = useRef(null)

  const stopAutoScroll = () => {
    const state = autoScrollStateRef.current
    if (!state) return
    cancelAnimationFrame(state.raf)
    window.removeEventListener('pointermove', state.onPointerMove)
    autoScrollStateRef.current = null
  }

  const startAutoScroll = () => {
    stopAutoScroll()
    const target = findScrollableAncestor(containerRef.current)
    const state = {
      pointerY: NaN,
      raf: 0,
      onPointerMove: (event) => { state.pointerY = event.clientY },
    }
    const step = () => {
      let top = 0
      let bottom = window.innerHeight
      if (target) {
        const rect = target.getBoundingClientRect()
        top = Math.max(0, rect.top)
        bottom = Math.min(window.innerHeight, rect.bottom)
      }
      const velocity = autoScrollVelocity(state.pointerY, top, bottom)
      if (velocity !== 0) {
        if (target) target.scrollTop += velocity
        else window.scrollBy(0, velocity)
      }
      state.raf = requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', state.onPointerMove)
    state.raf = requestAnimationFrame(step)
    autoScrollStateRef.current = state
  }

  useEffect(() => stopAutoScroll, [])

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localIds.indexOf(active.id)
    const newIndex = localIds.indexOf(over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(localIds, oldIndex, newIndex)
    pendingRef.current = next
    setLocalIds(next)
    const result = onReorder(next)
    if (result && typeof result.then === 'function') {
      result.catch(() => {}).then(() => {
        // Let the parent's refreshed ids render first; if it never adopted this
        // order (save failed), fall back to the source of truth.
        setTimeout(() => {
          if (pendingRef.current === next) {
            pendingRef.current = null
            setLocalIds(idsRef.current)
          }
        }, 0)
      })
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      autoScroll={false}
      onDragStart={startAutoScroll}
      onDragCancel={stopAutoScroll}
      onDragEnd={(event) => {
        stopAutoScroll()
        handleDragEnd(event)
      }}
    >
      <SortableContext items={localIds} strategy={verticalListSortingStrategy}>
        <div ref={containerRef} className={className}>
          {localIds.map(id => (
            <SortableRow key={id} id={id} disabled={disabled} renderRow={renderRow} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, disabled, renderRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-20' : undefined}
    >
      {renderRow(id, { handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  )
}

export function DragHandle({ handleProps, title = 'Drag to reorder', className = '' }) {
  return (
    <button
      type="button"
      title={title}
      {...handleProps}
      className={[
        'cursor-grab touch-none select-none rounded border border-white/10 px-1.5 py-1 text-sm leading-none text-dash-tertiary transition hover:border-dash-gold/60 hover:text-dash-cream active:cursor-grabbing',
        className,
      ].join(' ')}
    >
      ⠿
    </button>
  )
}
