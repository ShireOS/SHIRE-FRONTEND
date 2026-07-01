-- ============================================
-- SHIRE Store Groups, Reseller Boarding, Dashboard Prefs
-- Run this in Supabase SQL Editor (after 20260701_reseller_roles_and_rate_plans.sql)
--
-- Adds:
--   1. store_groups + store_group_members  (owner-scoped named groups)
--   2. store_invites                       (reseller boarding: quick invite + draft & claim)
--   3. claim_store(token)                  (atomic ownership transfer on claim)
--   4. profiles.dashboard_prefs            (nav slimming / landing preferences)
--
-- Notes:
--   - Draft stores are plain restaurants rows with status='draft' and
--     owner_id = the reseller who drafted them (existing owner RLS covers
--     access); claim_store() transfers owner_id to the claimant.
--   - restaurants.owner_id is the single source of ownership. Member rows in
--     restaurant_members never carry role='owner'.
-- ============================================

-- 1. STORE GROUPS
-- ============================================
CREATE TABLE IF NOT EXISTS public.store_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, name)
);

ALTER TABLE public.store_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their store groups" ON public.store_groups;
CREATE POLICY "Owners manage their store groups"
  ON public.store_groups FOR ALL
  USING (owner_id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.store_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.store_groups(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, restaurant_id)
);

ALTER TABLE public.store_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group owners manage group members" ON public.store_group_members;
CREATE POLICY "Group owners manage group members"
  ON public.store_group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.store_groups g
      WHERE g.id = group_id AND (g.owner_id = auth.uid() OR public.is_platform_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_groups g
      WHERE g.id = group_id AND (g.owner_id = auth.uid() OR public.is_platform_admin())
    )
  );


-- 2. STORE INVITES (reseller boarding)
-- ============================================
CREATE TABLE IF NOT EXISTS public.store_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text,
  kind text NOT NULL DEFAULT 'quick' CHECK (kind IN ('quick', 'draft')),
  restaurant_name text,
  draft_restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  -- Rate plan snapshot for quick invites (draft invites carry a real
  -- restaurant_rate_plans row on the draft restaurant instead).
  default_rate_plan jsonb,
  -- Display snapshot for the public claim page (which cannot read the draft
  -- restaurant row through RLS): name, location, type, payout schedule, rate
  -- summary. Written at invite creation.
  summary jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.store_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inviters manage their store invites" ON public.store_invites;
CREATE POLICY "Inviters manage their store invites"
  ON public.store_invites FOR ALL
  USING (invited_by = auth.uid() OR public.is_platform_admin())
  WITH CHECK (invited_by = auth.uid() OR public.is_platform_admin());

-- Claim page loads the invite by token pre-auth (same convention as invitations).
DROP POLICY IF EXISTS "Anyone can view store invite by token" ON public.store_invites;
CREATE POLICY "Anyone can view store invite by token"
  ON public.store_invites FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_store_invites_token ON public.store_invites(token);
CREATE INDEX IF NOT EXISTS idx_store_invites_inviter ON public.store_invites(invited_by, status);


-- 3. CLAIM FUNCTION (atomic ownership transfer)
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_store(invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite public.store_invites%ROWTYPE;
  claimed_restaurant_id uuid;
  claimant uuid := auth.uid();
BEGIN
  IF claimant IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim a store.';
  END IF;

  SELECT * INTO invite
  FROM public.store_invites
  WHERE token = invite_token
  FOR UPDATE;

  IF invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found.';
  END IF;
  IF invite.status <> 'pending' THEN
    RAISE EXCEPTION 'This invite is no longer active.';
  END IF;
  IF invite.expires_at < now() THEN
    RAISE EXCEPTION 'This invite has expired.';
  END IF;

  IF invite.draft_restaurant_id IS NOT NULL THEN
    UPDATE public.restaurants
    SET owner_id = claimant,
        status = 'onboarding'
    WHERE id = invite.draft_restaurant_id
      AND status = 'draft'
    RETURNING id INTO claimed_restaurant_id;

    IF claimed_restaurant_id IS NULL THEN
      RAISE EXCEPTION 'The draft store is no longer available to claim.';
    END IF;
  ELSE
    INSERT INTO public.restaurants (name, owner_id, status, onboarding_step)
    VALUES (COALESCE(invite.restaurant_name, 'New restaurant'), claimant, 'onboarding', 1)
    RETURNING id INTO claimed_restaurant_id;

    IF invite.default_rate_plan IS NOT NULL THEN
      INSERT INTO public.restaurant_rate_plans (
        restaurant_id, card_rate, pricing_mode, dual_pricing_enabled, applies_to, basis, updated_by
      )
      VALUES (
        claimed_restaurant_id,
        COALESCE((invite.default_rate_plan->>'card_rate')::numeric, 0.035),
        COALESCE(invite.default_rate_plan->>'pricing_mode', 'dual_pricing_posted_electronic'),
        COALESCE((invite.default_rate_plan->>'dual_pricing_enabled')::boolean, true),
        COALESCE(
          (SELECT array_agg(value) FROM jsonb_array_elements_text(invite.default_rate_plan->'applies_to')),
          ARRAY['credit', 'debit', 'terminal', 'gift_card']
        ),
        COALESCE(invite.default_rate_plan->>'basis', 'subtotal_plus_tax'),
        invite.invited_by
      )
      ON CONFLICT (restaurant_id) DO NOTHING;
    END IF;
  END IF;

  -- The boarding reseller keeps (or gains) the portfolio connection.
  INSERT INTO public.reseller_restaurants (reseller_id, restaurant_id, status, assigned_by)
  VALUES (invite.invited_by, claimed_restaurant_id, 'active', invite.invited_by)
  ON CONFLICT (reseller_id, restaurant_id) DO UPDATE SET status = 'active';

  UPDATE public.store_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = claimant
  WHERE id = invite.id;

  RETURN claimed_restaurant_id;
END;
$$;


-- 4. DASHBOARD PREFERENCES
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_prefs jsonb NOT NULL DEFAULT '{}';
