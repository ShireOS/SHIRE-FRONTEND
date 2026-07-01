-- ============================================
-- SHIRE Reseller Roles + Rate Plans Migration
-- Run this in Supabase SQL Editor
--
-- Adds:
--   1. profiles.account_type  (owner | reseller | admin)
--   2. reseller_restaurants   (reseller portfolio assignments)
--   3. restaurant_rate_plans  (reseller-managed transaction pricing)
--   4. rate_change_requests   (rate raises require owner approval)
--   5. RLS so resellers see assigned restaurants, admins see all
-- ============================================

-- 1. ACCOUNT TYPE ON PROFILES
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'owner'
  CHECK (account_type IN ('owner', 'reseller', 'admin'));

-- Helper: is the current user a platform admin?
-- SECURITY DEFINER so RLS policies can call it without recursing into profiles RLS.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND account_type = 'admin'
  );
$$;

-- Admins can read every profile (Users management page).
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_platform_admin());

-- Admins can update account_type / profile fields (promote to reseller).
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_platform_admin());


-- 2. RESELLER PORTFOLIO ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.reseller_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active', -- active, suspended
  -- Owner-configurable visibility. Analytics (profit breakdowns) and rate/payout
  -- data are mandatory for resellers and intentionally NOT represented here.
  permissions jsonb NOT NULL DEFAULT '{"setup": true, "scheduling": false, "messaging": false, "payments": false}',
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(reseller_id, restaurant_id)
);

ALTER TABLE public.reseller_restaurants ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an active reseller for a given restaurant?
-- Defined AFTER the table it references — Postgres validates SQL function
-- bodies at creation time.
CREATE OR REPLACE FUNCTION public.is_reseller_for(target_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reseller_restaurants rr
    WHERE rr.restaurant_id = target_restaurant_id
      AND rr.reseller_id = auth.uid()
      AND rr.status = 'active'
  );
$$;

DROP POLICY IF EXISTS "Resellers can view their assignments" ON public.reseller_restaurants;
CREATE POLICY "Resellers can view their assignments"
  ON public.reseller_restaurants FOR SELECT
  USING (reseller_id = auth.uid() OR public.is_platform_admin());

-- Owners can see which resellers are attached to their restaurants.
DROP POLICY IF EXISTS "Owners can view their restaurant resellers" ON public.reseller_restaurants;
CREATE POLICY "Owners can view their restaurant resellers"
  ON public.reseller_restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage reseller assignments" ON public.reseller_restaurants;
CREATE POLICY "Admins manage reseller assignments"
  ON public.reseller_restaurants FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Owners tune what their resellers can see (the permissions column).
DROP POLICY IF EXISTS "Owners can update reseller permissions" ON public.reseller_restaurants;
CREATE POLICY "Owners can update reseller permissions"
  ON public.reseller_restaurants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );


-- 3. RESTAURANT VISIBILITY FOR RESELLERS / ADMINS
-- ============================================
DROP POLICY IF EXISTS "Resellers can view assigned restaurants" ON public.restaurants;
CREATE POLICY "Resellers can view assigned restaurants"
  ON public.restaurants FOR SELECT
  USING (public.is_reseller_for(id));

DROP POLICY IF EXISTS "Admins can view all restaurants" ON public.restaurants;
CREATE POLICY "Admins can view all restaurants"
  ON public.restaurants FOR SELECT
  USING (public.is_platform_admin());


-- 4. RESTAURANT RATE PLANS (reseller-managed pricing)
-- ============================================
CREATE TABLE IF NOT EXISTS public.restaurant_rate_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  card_rate numeric(5,4) NOT NULL DEFAULT 0.0350, -- effective transaction rate, e.g. 0.035 = 3.5%
  pricing_mode text NOT NULL DEFAULT 'dual_pricing_posted_electronic'
    CHECK (pricing_mode IN ('dual_pricing_posted_electronic', 'cash_discount', 'credit_surcharge', 'none')),
  dual_pricing_enabled boolean NOT NULL DEFAULT true,
  applies_to text[] NOT NULL DEFAULT ARRAY['credit', 'debit', 'terminal', 'gift_card'],
  basis text NOT NULL DEFAULT 'subtotal_plus_tax' CHECK (basis IN ('subtotal', 'subtotal_plus_tax')),
  notes text,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.restaurant_rate_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rate plans visible to owner reseller admin" ON public.restaurant_rate_plans;
CREATE POLICY "Rate plans visible to owner reseller admin"
  ON public.restaurant_rate_plans FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.is_reseller_for(restaurant_id)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

-- Resellers/admins create and edit rate plans. Owners also get write access so
-- approving a raise can apply it. Raise-vs-lower enforcement lives in app flow:
-- lowers write directly, raises go through rate_change_requests first.
DROP POLICY IF EXISTS "Rate plans writable by reseller admin owner" ON public.restaurant_rate_plans;
CREATE POLICY "Rate plans writable by reseller admin owner"
  ON public.restaurant_rate_plans FOR ALL
  USING (
    public.is_platform_admin()
    OR public.is_reseller_for(restaurant_id)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_reseller_for(restaurant_id)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

CREATE TRIGGER update_restaurant_rate_plans_updated_at
  BEFORE UPDATE ON public.restaurant_rate_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 5. RATE CHANGE REQUESTS (raises need owner approval)
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  current_rate numeric(5,4),
  proposed_rate numeric(5,4) NOT NULL,
  proposed_changes jsonb DEFAULT '{}', -- full proposed plan snapshot (mode, tenders, etc.)
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.rate_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rate requests visible to parties" ON public.rate_change_requests;
CREATE POLICY "Rate requests visible to parties"
  ON public.rate_change_requests FOR SELECT
  USING (
    public.is_platform_admin()
    OR requested_by = auth.uid()
    OR public.is_reseller_for(restaurant_id)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Resellers and admins create rate requests" ON public.rate_change_requests;
CREATE POLICY "Resellers and admins create rate requests"
  ON public.rate_change_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND (public.is_platform_admin() OR public.is_reseller_for(restaurant_id))
  );

-- Owners resolve (approve/decline); requesters may cancel their own pending request.
DROP POLICY IF EXISTS "Owners resolve rate requests" ON public.rate_change_requests;
CREATE POLICY "Owners resolve rate requests"
  ON public.rate_change_requests FOR UPDATE
  USING (
    public.is_platform_admin()
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );


-- 6. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_reseller_restaurants_reseller ON public.reseller_restaurants(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_restaurants_restaurant ON public.reseller_restaurants(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rate_plans_restaurant ON public.restaurant_rate_plans(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rate_requests_restaurant ON public.rate_change_requests(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_rate_requests_requester ON public.rate_change_requests(requested_by);
