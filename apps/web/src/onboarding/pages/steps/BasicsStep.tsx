import { useState } from 'react'
import type { RestaurantType, UseOnboardingReturn } from '../../hooks/useOnboarding'
import { supabase } from '../../../shared/lib/supabase'

interface BasicsStepProps {
  onboarding: UseOnboardingReturn
}

const RESTAURANT_TYPES: { value: RestaurantType; label: string; icon: string }[] = [
  { value: 'fine_dining', label: 'Fine Dining', icon: '🍷' },
  { value: 'casual', label: 'Casual Dining', icon: '🍽️' },
  { value: 'fast_casual', label: 'Fast Casual', icon: '🥗' },
  { value: 'bar', label: 'Bar / Pub', icon: '🍺' },
  { value: 'cafe', label: 'Cafe', icon: '☕' },
  { value: 'food_truck', label: 'Food Truck', icon: '🚚' },
]

const CUISINE_TYPES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'Mediterranean', 'French', 'Korean', 'Vietnamese', 'Greek',
  'Spanish', 'Middle Eastern', 'Caribbean', 'Southern', 'Seafood', 'Steakhouse',
  'Pizza', 'Burgers', 'Sushi', 'BBQ', 'Vegan', 'Farm-to-Table',
]

export function BasicsStep({ onboarding }: BasicsStepProps) {
  const { data, updateData, createRestaurant, goToStep, isLoading, error } = onboarding
  const [localError, setLocalError] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)

  const submitBasics = async () => {
    setLocalError(null)

    // Validate
    if (!data.name.trim()) {
      setLocalError('Restaurant name is required')
      return
    }
    try {
      const restaurant = await createRestaurant()
      if (coverFile) {
        const extension = coverFile.type === 'image/jpeg' ? 'jpg' : coverFile.type === 'image/webp' ? 'webp' : 'png'
        const objectPath = `${restaurant.id}/covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
        const upload = await supabase.storage.from('restaurant-assets').upload(objectPath, coverFile, {
          cacheControl: '31536000',
          contentType: coverFile.type,
          upsert: false,
        })
        if (upload.error) throw upload.error
        const publicUrl = supabase.storage.from('restaurant-assets').getPublicUrl(objectPath).data.publicUrl
        const update = await supabase.from('restaurants').update({ cover_image_url: publicUrl }).eq('id', restaurant.id)
        if (update.error) throw update.error
      }
      goToStep(1)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not save restaurant basics')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submitBasics()
  }

  const toggleCuisine = (cuisine: string) => {
    const current = data.cuisine_types || []
    if (current.includes(cuisine)) {
      updateData({ cuisine_types: current.filter(c => c !== cuisine) })
    } else {
      updateData({ cuisine_types: [...current, cuisine] })
    }
  }

  const displayError = localError || error

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {displayError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {displayError}
        </div>
      )}

      {/* Restaurant Name */}
      <div>
        <label htmlFor="name" className="label-mono block mb-2 text-[rgb(var(--gold))]">
          Restaurant Name *
        </label>
        <input
          id="name"
          type="text"
          required
          value={data.name}
          onChange={(e) => updateData({ name: e.target.value })}
          className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
          placeholder="The Golden Fork"
        />
      </div>

      {/* Address */}
      <div className="space-y-4">
        <label className="label-mono block text-[rgb(var(--gold))]">
          Location <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>

        <input
          type="text"
          value={data.address}
          onChange={(e) => updateData({ address: e.target.value })}
          className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
          placeholder="123 Main Street"
        />

        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            value={data.city}
            onChange={(e) => updateData({ city: e.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
            placeholder="City"
          />
          <input
            type="text"
            value={data.state}
            onChange={(e) => updateData({ state: e.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
            placeholder="State"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            value={data.postal_code}
            onChange={(e) => updateData({ postal_code: e.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
            placeholder="Zip Code"
          />
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all"
            placeholder="Phone (optional)"
          />
        </div>
      </div>

      {/* Restaurant Type */}
      <div>
        <label className="label-mono block mb-3 text-[rgb(var(--gold))]">
          Restaurant Type <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {RESTAURANT_TYPES.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateData({ type: type.value })}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                data.type === type.value
                  ? 'border-[rgb(var(--gold))] bg-[rgba(201,169,98,0.08)] shadow-[0_0_12px_rgba(201,169,98,0.1)]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[rgb(var(--text-secondary))] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              <span className="text-2xl">{type.icon}</span>
              <span className="text-sm font-medium text-[rgb(var(--text-primary))]">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine Types */}
      <div>
        <label className="label-mono block mb-3 text-[rgb(var(--gold))]">
          Cuisine Type(s) <span className="text-[rgb(var(--text-tertiary))]">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CUISINE_TYPES.map(cuisine => (
            <button
              key={cuisine}
              type="button"
              onClick={() => toggleCuisine(cuisine)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                data.cuisine_types?.includes(cuisine)
                  ? 'bg-white text-black'
                  : 'bg-[rgba(255,255,255,0.05)] text-[rgb(var(--text-tertiary))] hover:bg-[rgba(255,255,255,0.1)]'
              }`}
            >
              {cuisine}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label-mono block mb-3 text-[rgb(var(--gold))]">POS Background <span className="text-[rgb(var(--text-tertiary))]">(optional)</span></label>
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.03)] px-6 py-5 text-center transition hover:border-[rgba(201,169,98,0.55)]">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] || null
              if (file && file.size > 5 * 1024 * 1024) {
                setLocalError('The POS background must be 5 MB or smaller.')
                setCoverFile(null)
              } else {
                setLocalError(null)
                setCoverFile(file)
              }
            }}
          />
          <span className="text-sm font-medium text-[rgb(var(--text-primary))]">{coverFile?.name || 'Choose a restaurant photo'}</span>
          <span className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">JPEG, PNG, or WebP. A landscape 4:3 image works best.</span>
        </label>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={() => void submitBasics()}
        disabled={isLoading}
        className="w-full py-4 px-6 bg-white text-black hover:bg-gray-100 disabled:opacity-50 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#d4a854]" />
            Creating...
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  )
}
