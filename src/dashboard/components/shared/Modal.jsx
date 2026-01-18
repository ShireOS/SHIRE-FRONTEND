import { X } from 'lucide-react'
import { Button } from './Button'

/**
 * Simple reusable modal component
 */
export function Modal({ isOpen, onClose, title, children, size = 'md', showClose = true }) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showClose) && (
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              {title && <h2 className="text-xl font-semibold text-gray-900">{title}</h2>}
              {showClose && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Modal footer for action buttons
 */
export function ModalFooter({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-end gap-3 pt-4 border-t border-gray-100 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Modal section for organizing content
 */
export function ModalSection({ title, children, className = '' }) {
  return (
    <div className={`mb-6 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>}
      {children}
    </div>
  )
}
