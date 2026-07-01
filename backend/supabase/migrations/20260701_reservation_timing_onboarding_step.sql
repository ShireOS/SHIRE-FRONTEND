alter table public.restaurants
  drop constraint if exists restaurants_onboarding_step_range;

alter table public.restaurants
  add constraint restaurants_onboarding_step_range
  check (onboarding_step between 0 and 20);
