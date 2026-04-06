import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { API_CONFIG } from '../../shared/api/config'
import { MenuItemsTable } from './MenuItemsTable'
import type { MenuEditorItem } from './MenuItemsTable'

interface MenuEditorProps {
  restaurantId: string
  mode: 'upload' | 'manual'
  initialItems?: MenuEditorItem[]
  onBack: () => void
  onSave: (items: MenuEditorItem[]) => void
}

type Phase = 'idle' | 'uploading' | 'extracting' | 'editing' | 'saving'

const getToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : ''
}

const baseUrl = (restaurantId: string) =>
  `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/menu`

const newBlankItem = (): MenuEditorItem => ({
  id: crypto.randomUUID(),
  name: '',
  category: '',
  price: '',
  description: '',
})

export function MenuEditor({ restaurantId, mode, initialItems, onBack, onSave }: MenuEditorProps) {
  const [items, setItems] = useState<MenuEditorItem[]>(initialItems ?? [])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(mode === 'manual' ? 'editing' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)')
      return
    }
    setError(null)

    try {
      // 1. Upload image
      setPhase('uploading')
      const token = await getToken()

      const ext = file.name.split('.').pop() ?? 'png'
      const safeName = file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 60)
        + `.${ext}`
      const safeFile = new File([file], safeName, { type: file.type })

      const formData = new FormData()
      formData.append('file', safeFile)

      const uploadRes = await fetch(`${baseUrl(restaurantId)}/upload-image`, {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.detail || `Upload failed (${uploadRes.status})`)
      }

      const { image_url } = await uploadRes.json()

      // 2. Extract menu items
      setPhase('extracting')
      const extractRes = await fetch(`${baseUrl(restaurantId)}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ image_url }),
      })

      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}))
        throw new Error(err.detail || `Extraction failed (${extractRes.status})`)
      }

      const extraction = await extractRes.json()
      const extracted: MenuEditorItem[] = (extraction.items || []).map((t: any) => ({
        id: crypto.randomUUID(),
        name: t.name ?? '',
        category: t.category ?? '',
        price: t.price != null ? String(t.price) : '',
        description: t.description ?? '',
      }))

      setItems(extracted)
      setPhase('editing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('idle')
    }
  }, [restaurantId])

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
    setError(null)
    setPhase('saving')
    try {
      const token = await getToken()
      const validItems = items.filter(item => item.name.trim() !== '')
      const payload = validItems.map(item => ({
        name: item.name.trim(),
        restaurant_id: restaurantId,
        category: item.category || undefined,
        price: item.price ? parseFloat(item.price) : undefined,
        description: item.description.trim() || undefined,
      }))

      const res = await fetch(`${baseUrl(restaurantId)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ items: payload }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Save failed (${res.status})`)
      }

      onSave(validItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setPhase('editing')
    }
  }

  const addItem = () => {
    setItems(prev => [...prev, newBlankItem()])
  }

  const isBusy = phase === 'uploading' || phase === 'extracting' || phase === 'saving'
  const validCount = items.filter(i => i.name.trim() !== '').length

  return (
    <div className="flex flex-col h-full min-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            if (items.length > 0) onSave(items)
            onBack()
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
            Save {validCount} Item{validCount !== 1 ? 's' : ''}
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-[rgb(var(--text-primary))] text-sm font-medium mb-1">Drop your menu image here</p>
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
      {(phase === 'uploading' || phase === 'extracting') && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[rgb(var(--gold))] mb-4" />
          <p className="text-[rgb(var(--text-primary))] text-sm font-medium">
            {phase === 'uploading' ? 'Uploading image...' : 'AI is reading your menu...'}
          </p>
          {phase === 'extracting' && (
            <p className="text-[rgb(var(--text-tertiary))] text-xs mt-1">This takes 10–30 seconds</p>
          )}
        </div>
      )}

      {/* Item editor */}
      {(phase === 'editing' || phase === 'saving') && (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex-1 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
            <MenuItemsTable
              items={items}
              onItemsChange={setItems}
              disabled={phase === 'saving'}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between">
            <button
              onClick={addItem}
              disabled={isBusy}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>

            {mode === 'upload' && (
              <button
                onClick={() => { setPhase('idle'); setItems([]) }}
                disabled={isBusy}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--text-secondary))] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgb(var(--text-primary))] disabled:opacity-40 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-upload
              </button>
            )}

            <p className="text-xs text-[rgb(var(--text-tertiary))]">
              {validCount} item{validCount !== 1 ? 's' : ''} · fill Name to save
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
