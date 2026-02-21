-- ============================================
-- Fix recursive RLS policy on restaurant_members
-- ============================================
-- Problem:
-- Existing SELECT policy "Owners can view restaurant members" references
-- public.restaurant_members inside its own USING clause, which triggers:
-- "infinite recursion detected in policy for relation \"restaurant_members\""
--
-- This migration replaces it with a non-recursive owner check through
-- public.restaurants.

BEGIN;

DROP POLICY IF EXISTS "Owners can view restaurant members" ON public.restaurant_members;

CREATE POLICY "Owners can view restaurant members"
  ON public.restaurant_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_members.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

COMMIT;
