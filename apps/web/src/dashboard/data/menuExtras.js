import { supabase } from '../../shared/lib/supabase'
import { fetchWithSupabaseAuth } from '../../shared/query'

// image_url (menu_items) and color (menu_categories) are portal-managed
// columns the ML backend's fixed response schemas don't include, so they are
// read and written directly through Supabase (RLS: can_manage_store_menu).

export async function fetchItemImages(restaurantId) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, image_url')
    .eq('restaurant_id', restaurantId)
    .not('image_url', 'is', null)
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.id, row.image_url]))
}

export async function setItemImage(restaurantId, itemId, imageUrl) {
  const { error } = await supabase
    .from('menu_items')
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
  if (error) throw error
}

export async function fetchCategoryColors(restaurantId) {
  const { data, error } = await supabase
    .from('menu_categories')
    .select('id, color')
    .eq('restaurant_id', restaurantId)
    .not('color', 'is', null)
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.id, row.color]))
}

export async function setCategoryColor(restaurantId, categoryId, color) {
  const { error } = await supabase
    .from('menu_categories')
    .update({ color, updated_at: new Date().toISOString() })
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)
  if (error) throw error
}

// Reuses the existing menu image-upload endpoint (Supabase Storage) for item
// photos; returns the public URL.
export async function uploadMenuImage(restaurantId, file) {
  const form = new FormData()
  form.append('file', file)
  const result = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/menu/upload-image`, {
    method: 'POST',
    body: form,
  })
  if (!result?.image_url) throw new Error('Upload did not return an image URL.')
  return result.image_url
}
