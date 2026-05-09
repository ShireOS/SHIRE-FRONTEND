import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Maximize2 } from 'lucide-react'
import { useState } from 'react'

const FEEDS = [
  { id: '1', label: 'Camera 1 — Entrance', src: '/hero/videos/demo1-hero.mp4' },
  { id: '2', label: 'Camera 2 — Main Floor', src: '/hero/videos/demo2-hero.mp4' },
  { id: '3', label: 'Camera 3 — Bar Area', src: '/hero/videos/demo3-hero.mp4' },
  { id: '4', label: 'Camera 4 — Patio', src: '/hero/videos/demo4-hero.mp4' },
]

interface CameraViewerProps {
  isOpen: boolean
  onClose: () => void
}

export function CameraViewer({ isOpen, onClose }: CameraViewerProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})

  // Autoplay all feeds when opened
  useEffect(() => {
    if (!isOpen) return
    const t = window.setTimeout(() => {
      Object.values(videoRefs.current).forEach((v) => {
        if (!v) return
        v.muted = true
        v.play().catch(() => {})
      })
    }, 100)
    return () => clearTimeout(t)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dim backdrop — click outside to close */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[90]"
          />

          {/* Popup panel — top-right, below topbar */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed top-[88px] right-4 z-[91] w-[560px] glass-panel rounded-xl border border-white/10 overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-semibold text-primary">Live Feeds</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 ml-1">
                  Backtesting
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-tertiary hover:text-primary transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2×2 grid */}
            <div className="grid grid-cols-2 gap-0.5 bg-black/40 p-0.5">
              {FEEDS.map((feed) => (
                <CameraCell
                  key={feed.id}
                  feed={feed}
                  videoRef={(el) => (videoRefs.current[feed.id] = el)}
                  onExpand={() => setExpanded(feed.id)}
                />
              ))}
            </div>
          </motion.div>

          {/* Fullscreen single feed */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="fullscreen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setExpanded(null)}
                className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center"
              >
                <button
                  className="absolute top-5 right-5 w-10 h-10 rounded-xl glass-panel flex items-center justify-center"
                  onClick={() => setExpanded(null)}
                >
                  <X className="w-5 h-5" />
                </button>
                <video
                  src={FEEDS.find((f) => f.id === expanded)?.src}
                  className="max-w-[90vw] max-h-[90vh] rounded-xl"
                  autoPlay
                  loop
                  muted
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}

function CameraCell({
  feed,
  videoRef,
  onExpand,
}: {
  feed: (typeof FEEDS)[number]
  videoRef: (el: HTMLVideoElement | null) => void
  onExpand: () => void
}) {
  return (
    <div className="relative aspect-video bg-black group overflow-hidden">
      <video
        ref={videoRef}
        src={feed.src}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        preload="auto"
      />

      {/* Amber backtesting dot — top-right corner */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 rounded-md px-1.5 py-0.5 backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400">BT</span>
      </div>

      {/* Camera label — top-left */}
      <div className="absolute top-2 left-2 bg-black/60 rounded-md px-2 py-0.5 backdrop-blur-sm">
        <span className="text-[10px] font-semibold text-white/80">{feed.label}</span>
      </div>

      {/* Expand button on hover */}
      <button
        onClick={onExpand}
        className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Maximize2 className="w-3.5 h-3.5 text-white/80" />
      </button>
    </div>
  )
}
