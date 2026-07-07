-- Reseller portfolio groups
--
-- Adds reseller-specific grouping for restaurants assigned through
-- reseller_restaurants. Group membership is organizational only; it does not
-- mutate restaurant configuration, ownership, onboarding, menu, POS settings,
-- or billing.

ALTER TYPE public.restaraunt_role ADD VALUE IF NOT EXISTS 'reseller';

CREATE TABLE IF NOT EXISTS public.reseller_restaurant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#D4A854',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reseller_restaurant_groups_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT reseller_restaurant_groups_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS reseller_restaurant_groups_reseller_name_key
  ON public.reseller_restaurant_groups (reseller_id, lower(name));

CREATE TABLE IF NOT EXISTS public.reseller_restaurant_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.reseller_restaurant_groups(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, restaurant_id),
  UNIQUE (group_id, restaurant_id)
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_reseller_restaurant_groups_updated_at ON public.reseller_restaurant_groups;
CREATE TRIGGER set_reseller_restaurant_groups_updated_at
  BEFORE UPDATE ON public.reseller_restaurant_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reseller_restaurant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_restaurant_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Resellers manage own portfolio groups" ON public.reseller_restaurant_groups;
CREATE POLICY "Resellers manage own portfolio groups"
  ON public.reseller_restaurant_groups
  FOR ALL
  USING (reseller_id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (reseller_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Resellers view own group members" ON public.reseller_restaurant_group_members;
CREATE POLICY "Resellers view own group members"
  ON public.reseller_restaurant_group_members
  FOR SELECT
  USING (reseller_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Resellers add own assigned restaurants to groups" ON public.reseller_restaurant_group_members;
CREATE POLICY "Resellers add own assigned restaurants to groups"
  ON public.reseller_restaurant_group_members
  FOR INSERT
  WITH CHECK (
    reseller_id = auth.uid()
    AND public.is_reseller_for(restaurant_id)
    AND EXISTS (
      SELECT 1
      FROM public.reseller_restaurant_groups g
      WHERE g.id = group_id
        AND g.reseller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Resellers move own assigned restaurants between groups" ON public.reseller_restaurant_group_members;
CREATE POLICY "Resellers move own assigned restaurants between groups"
  ON public.reseller_restaurant_group_members
  FOR UPDATE
  USING (reseller_id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (
    public.is_platform_admin()
    OR (
      reseller_id = auth.uid()
      AND public.is_reseller_for(restaurant_id)
      AND EXISTS (
        SELECT 1
        FROM public.reseller_restaurant_groups g
        WHERE g.id = group_id
          AND g.reseller_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Resellers remove own restaurants from groups" ON public.reseller_restaurant_group_members;
CREATE POLICY "Resellers remove own restaurants from groups"
  ON public.reseller_restaurant_group_members
  FOR DELETE
  USING (reseller_id = auth.uid() OR public.is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_restaurant_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_restaurant_group_members TO authenticated;
