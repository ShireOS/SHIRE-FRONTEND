import { useState, useEffect } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { ModifierEditor } from '../../components/ModifierEditor'
import type { MenuEditorItem } from '../../components/MenuItemsTable'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'

interface ModifierStepProps {
  onboarding: UseOnboardingReturn
}

export function ModifierStep({ onboarding }: ModifierStepProps) {
  const { nextStep, prevStep, restaurantId: rawRestaurantId } = onboarding
  const restaurantId = rawRestaurantId ?? ''

  const [menuItems, setMenuItems] = useState<MenuEditorItem[]>([])

  // Load the menu items saved in the previous step so the assignment popup is populated
  useEffect(() => {
    if (!restaurantId) return
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ? `Bearer ${session.access_token}` : ''
      const res = await fetch(
        `${API_CONFIG.baseUrl}/restaurants/${restaurantId}/menu/items`,
        { headers: { Authorization: token } }
      ).catch(() => null)
      if (!res?.ok) return
      const items = await res.json()
      if (Array.isArray(items)) {
        setMenuItems(items.map((item: any) => ({
          id: item.id ?? crypto.randomUUID(),
          name: item.name ?? '',
          category: item.category ?? '',
          price: item.price != null ? String(item.price) : '',
          description: item.description ?? '',
        })))
      }
    }
    void load()
  }, [restaurantId])

  return (
    <ModifierEditor
      restaurantId={restaurantId}
      menuItems={menuItems}
      onBack={prevStep}
      onDone={nextStep}
    />
  )
}
