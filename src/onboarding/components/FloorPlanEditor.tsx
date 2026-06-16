import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import { FloorPlanCanvas } from './FloorPlanCanvas'
import type { FloorPlanTable } from './FloorPlanCanvas'

interface FloorPlanEditorProps {
  restaurantId: string
  mode: 'upload' | 'manual'
  initialTables?: FloorPlanTable[]
  onBack: () => void
  onSave: (tables: FloorPlanTable[]) => void
}

type Phase = 'idle' | 'uploading' | 'analyzing' | 'editing' | 'saving'

const getToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : ''
}

const baseUrl = (restaurantId: string) =>
  `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/floor-plan`

export function FloorPlanEditor({ restaurantId, mode, initialTables, onBack, onSave }: FloorPlanEditorProps) {
  const [tables, setTables] = useState<FloorPlanTable[]>(initialTables ?? [])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(mode === 'manual' ? 'editing' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const updateTables = useCallback((next: FloorPlanTable[] | ((current: FloorPlanTable[]) => FloorPlanTable[])) => {
    setIsDirty(true)
    setTables(next)
  }, [])

  // Handle file upload + analyze
  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)')
      return
    }
    setError(null)

    try {
      // 1. Upload
      setPhase('uploading')
      const token = await getToken()
      // Sanitize filename — Supabase Storage rejects spaces and special chars
      const ext = file.name.split('.').pop() ?? 'png'
      const safeName = file.name
        .replace(/\.[^.]+$/, '')          // strip extension
        .replace(/[^a-zA-Z0-9_-]/g, '_') // replace anything unsafe with _
        .replace(/_+/g, '_')              // collapse consecutive underscores
        .slice(0, 60)                     // cap length
        + `.${ext}`
      const safeFile = new File([file], safeName, { type: file.type })

      const formData = new FormData()
      formData.append('file', safeFile)

      const uploadRes = await fetch(`${baseUrl(restaurantId)}/upload`, {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.detail || `Upload failed (${uploadRes.status})`)
      }

      const { image_url } = await uploadRes.json()
      setImageUrl(image_url)

      // 2. Analyze
      setPhase('analyzing')
      const analyzeRes = await fetch(`${baseUrl(restaurantId)}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ image_url }),
      })

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({}))
        throw new Error(err.detail || `Analysis failed (${analyzeRes.status})`)
      }

      const analysis = await analyzeRes.json()

      // Map API response to FloorPlanTable
      const detected: FloorPlanTable[] = (analysis.tables || []).map((t: any) => ({
        id: t.id || crypto.randomUUID(),
        center_x: t.position?.center_x ?? 50,
        center_y: t.position?.center_y ?? 50,
        width: t.position?.width ?? 12,
        height: t.position?.height ?? 10,
        capacity: t.capacity ?? 4,
        shape: 'rectangular' as const,
        confidence: t.confidence,
        notes: t.notes,
      }))

      updateTables(detected)
      setPhase('editing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('idle')
    }
  }, [restaurantId, updateTables])

  // Drag-and-drop on the upload zone
  useEffect(() => {
    const zone = dropZoneRef.current
    if (!zone || phase !== 'idle') return

    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation() }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files?.[0]
      if (file) processFile(file)
    }

    zone.addEventListener('dragover', onDragOver)
    zone.addEventListener('drop', onDrop)
    return () => {
      zone.removeEventListener('dragover', onDragOver)
      zone.removeEventListener('drop', onDrop)
    }
  }, [phase, processFile])

  const handleSave = async () => {
    if (!isDirty) {
      onBack()
      return
    }
    setError(null)
    setPhase('saving')
    try {
      const token = await getToken()
      const res = await fetch(`${baseUrl(restaurantId)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          image_url: imageUrl,
          // Transform internal flat format → API nested position format
          tables: tables.map(t => ({
            id: t.id,
            position: { center_x: t.center_x, center_y: t.center_y, width: t.width, height: t.height },
            shape: t.shape,
            capacity: t.capacity,
            confidence: t.confidence,
            notes: t.notes,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Save failed (${res.status})`)
      }

      setIsDirty(false)
      onSave(tables)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setPhase('editing')
    }
  }

  const addTable = () => {
    const offset = (tables.length % 5) * 3
    const newTable: FloorPlanTable = {
      id: crypto.randomUUID(),
      center_x: 30 + offset,
      center_y: 30 + offset,
      width: 12,
      height: 10,
      capacity: 4,
      shape: 'rectangular',
    }
    updateTables(prev => [...prev, newTable])
  }

  const isBusy = phase === 'uploading' || phase === 'analyzing' || phase === 'saving'

  return (
    <div className="flex flex-col h-full min-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={async () => {
            if (tables.length > 0 && isDirty) {
              // handleSave calls onSave on success (which closes editor via parent)
              // on failure it shows an error and stays open so user doesn't lose work
              await handleSave()
            } else {
              onBack()
            }
          }}
          disabled={isBusy}
          className="flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {phase === 'editing' && (
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[rgb(var(--gold))] text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            {isDirty ? `Save ${tables.length} Table${tables.length !== 1 ? 's' : ''}` : 'Done'}
          </button>
        )}

        {phase === 'saving' && (
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))]">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[rgb(var(--gold))]" />
            Saving...
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Upload zone (upload mode, idle phase) */}
      {mode === 'upload' && phase === 'idle' && (
        <div
          ref={dropZoneRef}
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[rgba(255,255,255,0.15)] rounded-xl cursor-pointer hover:border-[rgba(201,169,98,0.4)] hover:bg-[rgba(201,169,98,0.03)] transition-all min-h-[300px]"
        >
          <svg className="w-10 h-10 text-[rgb(var(--text-tertiary))] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-[rgb(var(--text-primary))] text-sm font-medium mb-1">Drop your floor plan image here</p>
          <p className="text-[rgb(var(--text-tertiary))] text-xs">or click to browse — JPG, PNG accepted</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
          />
        </div>
      )}

      {/* Loading states */}
      {(phase === 'uploading' || phase === 'analyzing') && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[rgb(var(--gold))] mb-4" />
          <p className="text-[rgb(var(--text-primary))] text-sm font-medium">
            {phase === 'uploading' ? 'Uploading image...' : 'AI is analyzing your floor plan...'}
          </p>
          {phase === 'analyzing' && (
            <p className="text-[rgb(var(--text-tertiary))] text-xs mt-1">This takes 10–30 seconds</p>
          )}
        </div>
      )}

      {/* Canvas editor */}
      {(phase === 'editing' || phase === 'saving') && (
        <div className="flex-1 flex flex-col gap-3">
          <FloorPlanCanvas
            tables={tables}
            onTablesChange={updateTables}
            mode="manual"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between">
            <button
              onClick={addTable}
              disabled={isBusy}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Table
            </button>

            {mode === 'upload' && (
              <button
                onClick={() => { setPhase('idle'); updateTables([]); setImageUrl(null) }}
                disabled={isBusy}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-analyze
              </button>
            )}

            <p className="text-xs text-[rgb(var(--text-tertiary))]">
              {tables.length} table{tables.length !== 1 ? 's' : ''} · drag to move · corner handles to resize · click to edit seats
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
