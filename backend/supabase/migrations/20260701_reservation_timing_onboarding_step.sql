alter table public.restaurants
  drop constraint if exists restaurants_onboarding_step_range;

alter table public.restaurants
  add constraint restaurants_onboarding_step_range
  check (onboarding_step between 0 and 20);

alter table public.restaurants
  drop constraint if exists restaurants_onboarding_completion_consistent;

alter table public.restaurants
  add constraint restaurants_onboarding_completion_consistent
  check (
    (
      status = 'onboarding'
      and onboarding_completed_at is null
      and onboarding_step between 0 and 20
    )
    or (
      status in ('active', 'paused', 'closed')
      and onboarding_completed_at is not null
      and onboarding_step between 8 and 20
    )
  );
