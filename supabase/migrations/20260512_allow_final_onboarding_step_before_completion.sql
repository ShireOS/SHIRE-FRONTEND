-- Let restaurants resume on the final onboarding screen before the owner
-- presses Complete Setup, while keeping active/dashboard-ready rows complete.

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_onboarding_completion_consistent;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_onboarding_completion_consistent
  CHECK (
    (
      status = 'onboarding'
      AND onboarding_completed_at IS NULL
      AND onboarding_step BETWEEN 0 AND 8
    )
    OR (
      status IN ('active', 'paused', 'closed')
      AND onboarding_completed_at IS NOT NULL
      AND onboarding_step = 8
    )
  ) NOT VALID;

ALTER TABLE public.restaurants
  VALIDATE CONSTRAINT restaurants_onboarding_completion_consistent;
