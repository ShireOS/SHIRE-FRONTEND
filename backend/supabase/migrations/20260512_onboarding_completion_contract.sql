-- Keep onboarding completion state impossible to half-apply.
-- Optional onboarding data can remain empty, but a non-onboarding restaurant
-- must have the completion marker that dashboard route guards rely on.

UPDATE public.restaurants
SET
  onboarding_step = 8,
  onboarding_completed_at = COALESCE(onboarding_completed_at, now())
WHERE status IN ('active', 'paused', 'closed')
  AND (onboarding_completed_at IS NULL OR COALESCE(onboarding_step, 0) < 8);

UPDATE public.restaurants
SET status = 'active'
WHERE onboarding_completed_at IS NOT NULL
  AND status = 'onboarding';

ALTER TABLE public.restaurants
  ALTER COLUMN status SET DEFAULT 'onboarding',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN onboarding_step SET DEFAULT 1,
  ALTER COLUMN onboarding_step SET NOT NULL;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_name_not_blank
  CHECK (length(btrim(name)) > 0) NOT VALID;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_status_known
  CHECK (status IN ('onboarding', 'active', 'paused', 'closed')) NOT VALID;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_onboarding_step_range
  CHECK (onboarding_step BETWEEN 0 AND 8) NOT VALID;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_onboarding_completion_consistent
  CHECK (
    (
      status = 'onboarding'
      AND onboarding_completed_at IS NULL
      AND onboarding_step < 8
    )
    OR (
      status IN ('active', 'paused', 'closed')
      AND onboarding_completed_at IS NOT NULL
      AND onboarding_step = 8
    )
  ) NOT VALID;

ALTER TABLE public.restaurants VALIDATE CONSTRAINT restaurants_name_not_blank;
ALTER TABLE public.restaurants VALIDATE CONSTRAINT restaurants_status_known;
ALTER TABLE public.restaurants VALIDATE CONSTRAINT restaurants_onboarding_step_range;
ALTER TABLE public.restaurants VALIDATE CONSTRAINT restaurants_onboarding_completion_consistent;
