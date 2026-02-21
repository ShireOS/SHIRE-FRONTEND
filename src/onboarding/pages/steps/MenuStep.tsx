import { useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'

interface MenuStepProps {
  onboarding: UseOnboardingReturn
}

interface MenuImportOption {
  id: 'upload' | 'toast' | 'scrape' | 'template' | 'manual' | 'skip'
  title: string
  description: string
  icon: React.ReactNode
  recommended?: boolean
  comingSoon?: boolean
}

const MENU_OPTIONS: MenuImportOption[] = [
  {
    id: 'upload',
    title: 'Upload Menu',
    description: 'Upload a PDF or image of your menu. AI will extract items automatically.',
    recommended: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: 'toast',
    title: 'Import from Toast',
    description: 'Connect your Toast POS and import your menu automatically.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    comingSoon: true,
  },
  {
    id: 'scrape',
    title: 'Import from Website',
    description: 'Enter your website URL and we\'ll extract your menu.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    comingSoon: true,
  },
  {
    id: 'template',
    title: 'Start from Template',
    description: 'Choose a template based on your cuisine type.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    comingSoon: true,
  },
  {
    id: 'manual',
    title: 'Add Manually',
    description: 'Enter your menu items one by one.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  {
    id: 'skip',
    title: 'Skip for Now',
    description: 'You can always add your menu later from the dashboard.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    ),
  },
]

export function MenuStep({ onboarding }: MenuStepProps) {
  const { data, updateData, saveMenuProgress, nextStep, isLoading, error } = onboarding
  const [selectedOption, setSelectedOption] = useState<string>(data.menu_import_method || 'skip')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId)
    updateData({ menu_import_method: optionId as any })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleContinue = async () => {
    try {
      await saveMenuProgress()
      nextStep()
    } catch {
      // Error handled by hook
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Options grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MENU_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => !option.comingSoon && handleOptionSelect(option.id)}
            disabled={option.comingSoon}
            className={`relative p-4 rounded-lg border text-left transition-all ${
              selectedOption === option.id
                ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)] shadow-[0_0_12px_rgba(201,169,98,0.1)]'
                : option.comingSoon
                  ? 'border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.01)] opacity-50 cursor-not-allowed'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.2)]'
            }`}
          >
            {option.recommended && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-[rgb(var(--gold))] text-black text-xs font-medium rounded-full">
                Recommended
              </span>
            )}
            {option.comingSoon && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-[rgba(255,255,255,0.1)] text-[rgb(var(--text-tertiary))] text-xs font-medium rounded-full">
                Coming Soon
              </span>
            )}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              selectedOption === option.id ? 'bg-[rgba(201,169,98,0.15)] text-[rgb(var(--gold))]' : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))]'
            }`}>
              {option.icon}
            </div>
            <h3 className="text-[rgb(var(--text-primary))] font-medium text-sm">{option.title}</h3>
            <p className="text-sm text-[rgb(var(--text-tertiary))] mt-1">{option.description}</p>
          </button>
        ))}
      </div>

      {/* Upload zone */}
      {selectedOption === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`p-8 border-2 border-dashed rounded-lg text-center transition-all ${
            isDragging
              ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.05)]'
              : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)]'
          }`}
        >
          {uploadedFile ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-[rgba(201,169,98,0.1)] rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[rgb(var(--gold))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-[rgb(var(--text-primary))] font-medium">{uploadedFile.name}</p>
                <p className="text-sm text-[rgb(var(--text-tertiary))]">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => setUploadedFile(null)}
                className="text-sm text-[#d4a854] hover:text-[rgb(var(--gold))] transition-colors"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-[rgba(255,255,255,0.05)] rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-[rgb(var(--text-tertiary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-[rgb(var(--text-primary))]">
                  Drag & drop your menu here, or{' '}
                  <label className="text-[#d4a854] hover:text-[rgb(var(--gold))] cursor-pointer transition-colors">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                    />
                  </label>
                </p>
                <p className="text-sm text-[rgb(var(--text-tertiary))] mt-1">
                  Supports PDF, PNG, JPG (max 10MB)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={() => { void handleContinue() }}
        disabled={isLoading}
        className="w-full py-4 px-6 bg-white text-black hover:bg-gray-100 disabled:opacity-50 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#d4a854]" />
            Processing...
          </>
        ) : selectedOption === 'skip' ? (
          'Skip & Continue'
        ) : (
          'Continue'
        )}
      </button>
    </div>
  )
}
