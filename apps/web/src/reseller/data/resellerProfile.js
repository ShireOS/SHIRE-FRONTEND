import { supabase } from '../../shared/lib/supabase'
import { fetchWithSupabaseAuth } from '../../shared/query'

export const DEFAULT_RESELLER_PROFILE = {
  organization_name: '',
  legal_business_name: '',
  business_email: '',
  phone: '',
  website: '',
  logo_url: '',
  default_general_propagation: 'current_group',
  default_specified_propagation: 'current_restaurant',
  onboarding_step: 1,
  onboarding_completed_at: null,
}

export const DEFAULT_RESELLER_PERMISSIONS = {
  view_analytics: true,
  edit_setup: false,
  propagate_changes: false,
  manage_groups: false,
  close_day: false,
  force_sync: false,
}

export function normalizeResellerProfile(profile) {
  return { ...DEFAULT_RESELLER_PROFILE, ...(profile || {}) }
}

export function isResellerProfileComplete(profile) {
  const row = normalizeResellerProfile(profile)
  return Boolean(
    row.organization_name?.trim()
      && row.legal_business_name?.trim()
      && row.business_email?.trim()
      && row.phone?.trim()
      && row.default_general_propagation
      && row.default_specified_propagation
  )
}

export async function fetchCurrentResellerContext(userId, accountType = 'reseller') {
  if (!userId) throw new Error('Not signed in.')
  if (accountType === 'reseller_employee') {
    const { data, error } = await supabase
      .from('reseller_employees')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('No active reseller employee profile found.')
    return {
      resellerId: data.reseller_id,
      employee: data,
      canManageEmployees: false,
      canEditProfile: false,
      canManageGroups: Boolean(data.permissions?.manage_groups),
    }
  }
  return {
    resellerId: userId,
    employee: null,
    canManageEmployees: accountType === 'reseller' || accountType === 'admin',
    canEditProfile: accountType === 'reseller' || accountType === 'admin',
    canManageGroups: accountType === 'reseller' || accountType === 'admin',
  }
}

export async function fetchResellerProfile(resellerId) {
  const { data, error } = await supabase
    .from('reseller_profiles')
    .select('*')
    .eq('reseller_id', resellerId)
    .maybeSingle()
  if (error) throw error
  return normalizeResellerProfile(data)
}

export async function saveResellerProfile(resellerId, profile, { complete = false } = {}) {
  const payload = {
    reseller_id: resellerId,
    organization_name: profile.organization_name?.trim() || '',
    legal_business_name: profile.legal_business_name?.trim() || null,
    business_email: profile.business_email?.trim() || null,
    phone: profile.phone?.trim() || null,
    website: profile.website?.trim() || null,
    logo_url: profile.logo_url || null,
    default_general_propagation: profile.default_general_propagation || 'current_group',
    default_specified_propagation: profile.default_specified_propagation || 'current_restaurant',
    onboarding_step: complete ? 4 : Math.max(1, Number(profile.onboarding_step) || 1),
    onboarding_completed_at: complete ? new Date().toISOString() : profile.onboarding_completed_at || null,
  }
  const { data, error } = await supabase
    .from('reseller_profiles')
    .upsert(payload, { onConflict: 'reseller_id' })
    .select('*')
    .single()
  if (error) throw error
  return normalizeResellerProfile(data)
}

export async function uploadResellerLogo(resellerId, file) {
  const extension = file.name?.split('.').pop()?.toLowerCase() || 'png'
  const path = `${resellerId}/logo-${Date.now()}.${extension}`
  const { error } = await supabase.storage
    .from('reseller-assets')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/png' })
  if (error) throw error
  const { data } = supabase.storage.from('reseller-assets').getPublicUrl(path)
  return data.publicUrl
}

export async function fetchResellerEmployees(resellerId) {
  const { data: employees, error } = await supabase
    .from('reseller_employees')
    .select('*, restaurant_assignments:reseller_employee_restaurants(restaurant_id), group_assignments:reseller_employee_groups(group_id)')
    .eq('reseller_id', resellerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (employees || []).map((employee) => ({
    ...employee,
    permissions: { ...DEFAULT_RESELLER_PERMISSIONS, ...(employee.permissions || {}) },
    restaurant_ids: (employee.restaurant_assignments || []).map((row) => row.restaurant_id),
    group_ids: (employee.group_assignments || []).map((row) => row.group_id),
  }))
}

export async function createResellerEmployee(input) {
  return fetchWithSupabaseAuth('/reseller/employee-invites', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
