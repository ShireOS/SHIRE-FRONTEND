// Supabase Database Types
// Auto-generated types for your database schema
// You can regenerate these with: npx supabase gen types typescript

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      restaurants: {
        Row: {
          id: string
          owner_id: string | null
          name: string
          slug: string | null
          address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string
          timezone: string
          type: RestaurantType | null
          cuisine_types: string[] | null
          phone: string | null
          email: string | null
          website: string | null
          logo_url: string | null
          cover_image_url: string | null
          yelp_url: string | null
          seating_capacity: number | null
          table_count: number | null
          status: RestaurantStatus
          onboarding_step: number
          onboarding_completed_at: string | null
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          name: string
          slug?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          timezone?: string
          type?: RestaurantType | null
          cuisine_types?: string[] | null
          phone?: string | null
          email?: string | null
          website?: string | null
          logo_url?: string | null
          cover_image_url?: string | null
          yelp_url?: string | null
          seating_capacity?: number | null
          table_count?: number | null
          status?: RestaurantStatus
          onboarding_step?: number
          onboarding_completed_at?: string | null
          config?: Json
        }
        Update: {
          owner_id?: string | null
          name?: string
          slug?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          timezone?: string
          type?: RestaurantType | null
          cuisine_types?: string[] | null
          phone?: string | null
          email?: string | null
          website?: string | null
          logo_url?: string | null
          cover_image_url?: string | null
          yelp_url?: string | null
          seating_capacity?: number | null
          table_count?: number | null
          status?: RestaurantStatus
          onboarding_step?: number
          onboarding_completed_at?: string | null
          config?: Json
          updated_at?: string
        }
      }
      restaurant_members: {
        Row: {
          id: string
          restaurant_id: string
          user_id: string
          role: MemberRole
          permissions: string[] | null
          invited_by: string | null
          invited_at: string
          accepted_at: string | null
          status: MemberStatus
        }
        Insert: {
          id?: string
          restaurant_id: string
          user_id: string
          role?: MemberRole
          permissions?: string[] | null
          invited_by?: string | null
          invited_at?: string
          accepted_at?: string | null
          status?: MemberStatus
        }
        Update: {
          role?: MemberRole
          permissions?: string[] | null
          accepted_at?: string | null
          status?: MemberStatus
        }
      }
      operating_hours: {
        Row: {
          id: string
          restaurant_id: string
          day_of_week: number
          open_time: string | null
          close_time: string | null
          is_closed: boolean
        }
        Insert: {
          id?: string
          restaurant_id: string
          day_of_week: number
          open_time?: string | null
          close_time?: string | null
          is_closed?: boolean
        }
        Update: {
          open_time?: string | null
          close_time?: string | null
          is_closed?: boolean
        }
      }
      integrations: {
        Row: {
          id: string
          restaurant_id: string
          provider: IntegrationProvider
          status: IntegrationStatus
          external_id: string | null
          access_token_encrypted: string | null
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          scopes: string[] | null
          provider_data: Json
          connected_at: string | null
          last_synced_at: string | null
          sync_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          provider: IntegrationProvider
          status?: IntegrationStatus
          external_id?: string | null
          access_token_encrypted?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          scopes?: string[] | null
          provider_data?: Json
          connected_at?: string | null
          last_synced_at?: string | null
          sync_error?: string | null
        }
        Update: {
          status?: IntegrationStatus
          external_id?: string | null
          access_token_encrypted?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          scopes?: string[] | null
          provider_data?: Json
          connected_at?: string | null
          last_synced_at?: string | null
          sync_error?: string | null
          updated_at?: string
        }
      }
      invitations: {
        Row: {
          id: string
          restaurant_id: string
          email: string
          role: MemberRole
          invited_by: string | null
          token: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          email: string
          role?: MemberRole
          invited_by?: string | null
          token: string
          expires_at: string
          accepted_at?: string | null
        }
        Update: {
          accepted_at?: string | null
        }
      }
      // Keep existing tables from your schema
      waiters: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          email: string | null
          phone: string | null
          role: string
          tier: string
          composite_score: number
          tier_updated_at: string | null
          total_shifts: number
          total_covers: number
          total_tips: number
          total_tables_served: number
          total_sales: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          email?: string | null
          phone?: string | null
          role?: string
          tier?: string
          composite_score?: number
          tier_updated_at?: string | null
          total_shifts?: number
          total_covers?: number
          total_tips?: number
          total_tables_served?: number
          total_sales?: number
          is_active?: boolean
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          role?: string
          tier?: string
          composite_score?: number
          tier_updated_at?: string | null
          total_shifts?: number
          total_covers?: number
          total_tips?: number
          total_tables_served?: number
          total_sales?: number
          is_active?: boolean
          updated_at?: string
        }
      }
      tables: {
        Row: {
          id: string
          restaurant_id: string
          section_id: string | null
          table_number: string
          capacity: number
          table_type: string
          location: string
          state: string
          state_confidence: number | null
          state_updated_at: string | null
          current_visit_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          section_id?: string | null
          table_number: string
          capacity: number
          table_type: string
          location?: string
          state?: string
          state_confidence?: number | null
          state_updated_at?: string | null
          current_visit_id?: string | null
          is_active?: boolean
        }
        Update: {
          section_id?: string | null
          table_number?: string
          capacity?: number
          table_type?: string
          location?: string
          state?: string
          state_confidence?: number | null
          state_updated_at?: string | null
          current_visit_id?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      sections: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          is_active?: boolean
        }
        Update: {
          name?: string
          is_active?: boolean
        }
      }
      menu_items: {
        Row: {
          id: string
          restaurant_id: string
          pos_item_id: string | null
          name: string
          category: string | null
          price: number | null
          cost: number | null
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          pos_item_id?: string | null
          name: string
          category?: string | null
          price?: number | null
          cost?: number | null
          is_available?: boolean
        }
        Update: {
          pos_item_id?: string | null
          name?: string
          category?: string | null
          price?: number | null
          cost?: number | null
          is_available?: boolean
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

// Enum types
export type RestaurantType =
  | 'fine_dining'
  | 'casual'
  | 'fast_casual'
  | 'bar'
  | 'cafe'
  | 'food_truck'

export type RestaurantStatus =
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'closed'

export type MemberRole =
  | 'owner'
  | 'manager'
  | 'server'
  | 'host'
  | 'kitchen'

export type MemberStatus =
  | 'pending'
  | 'active'
  | 'deactivated'

export type IntegrationProvider =
  | 'sevenshifts'
  | 'toast'
  | 'deputy'
  | 'square'

export type IntegrationStatus =
  | 'pending'
  | 'connected'
  | 'error'

// Helper types for common use
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type RestaurantMember = Database['public']['Tables']['restaurant_members']['Row']
export type OperatingHours = Database['public']['Tables']['operating_hours']['Row']
export type Integration = Database['public']['Tables']['integrations']['Row']
export type Invitation = Database['public']['Tables']['invitations']['Row']
export type Waiter = Database['public']['Tables']['waiters']['Row']
export type Table = Database['public']['Tables']['tables']['Row']
export type Section = Database['public']['Tables']['sections']['Row']
export type MenuItem = Database['public']['Tables']['menu_items']['Row']
