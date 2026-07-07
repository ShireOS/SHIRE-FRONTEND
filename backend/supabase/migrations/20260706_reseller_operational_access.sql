-- Reseller operational access
--
-- Resellers assigned through reseller_restaurants can manage setup/config data
-- for those assigned restaurants. This does not make them restaurant owners;
-- it grants scoped operational access through public.is_reseller_for().

DROP POLICY IF EXISTS "Resellers can update assigned restaurants" ON public.restaurants;
CREATE POLICY "Resellers can update assigned restaurants"
  ON public.restaurants
  FOR UPDATE
  USING (public.is_reseller_for(id))
  WITH CHECK (public.is_reseller_for(id));

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'operating_hours',
    'sections',
    'tax_rates',
    'service_charges',
    'discount_rules',
    'pos_role_permissions',
    'pos_tip_payroll_settings',
    'job_codes',
    'employee_job_codes',
    'waiters',
    'menu_categories',
    'menu_items',
    'menu_modifiers',
    'menu_modifier_groups',
    'kitchen_stations',
    'kitchen_output_targets',
    'kitchen_station_targets',
    'kitchen_routing_rules',
    'restaurant_onboarding_state',
    'restaurant_rate_plans'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Resellers manage assigned restaurant ' || table_name, table_name);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_reseller_for(restaurant_id)) WITH CHECK (public.is_reseller_for(restaurant_id))',
        'Resellers manage assigned restaurant ' || table_name,
        table_name
      );
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Resellers manage assigned restaurant pos_restaurant_configs" ON public.pos_restaurant_configs;
CREATE POLICY "Resellers manage assigned restaurant pos_restaurant_configs"
  ON public.pos_restaurant_configs
  FOR ALL
  USING (public.is_reseller_for(id))
  WITH CHECK (public.is_reseller_for(id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_restaurant_configs TO authenticated;

-- Join tables without a direct restaurant_id need policies through their parent
-- group. They are used by the modifier editor.
DROP POLICY IF EXISTS "Resellers manage assigned modifier group options" ON public.menu_modifier_group_options;
CREATE POLICY "Resellers manage assigned modifier group options"
  ON public.menu_modifier_group_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_modifier_groups g
      WHERE g.id = group_id
        AND public.is_reseller_for(g.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.menu_modifier_groups g
      WHERE g.id = group_id
        AND public.is_reseller_for(g.restaurant_id)
    )
  );

DROP POLICY IF EXISTS "Resellers manage assigned modifier item groups" ON public.menu_modifier_group_items;
CREATE POLICY "Resellers manage assigned modifier item groups"
  ON public.menu_modifier_group_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_modifier_groups g
      WHERE g.id = group_id
        AND public.is_reseller_for(g.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.menu_modifier_groups g
      WHERE g.id = group_id
        AND public.is_reseller_for(g.restaurant_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_modifier_group_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_modifier_group_items TO authenticated;

DROP POLICY IF EXISTS "Resellers manage assigned modifier items" ON public.menu_modifier_items;
CREATE POLICY "Resellers manage assigned modifier items"
  ON public.menu_modifier_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.menu_items item
      WHERE item.id = item_id
        AND public.is_reseller_for(item.restaurant_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.menu_modifiers modifier
      WHERE modifier.id = modifier_id
        AND public.is_reseller_for(modifier.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.menu_items item
      WHERE item.id = item_id
        AND public.is_reseller_for(item.restaurant_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.menu_modifiers modifier
      WHERE modifier.id = modifier_id
        AND public.is_reseller_for(modifier.restaurant_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_modifier_items TO authenticated;
