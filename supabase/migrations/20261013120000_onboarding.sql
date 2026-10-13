-- Onboarding answers on the profile, and a link from a user's exercise back to
-- the public catalog entry it was copied from.

alter table public.profiles
  add column height_cm numeric check (height_cm > 0),
  add column start_weight_kg numeric check (start_weight_kg > 0),
  add column target_weight_kg numeric check (target_weight_kg > 0),
  add column diet_preference text check (diet_preference in ('vegan', 'vegetarian', 'eggetarian', 'non_vegetarian')),
  add column goal text check (goal in ('gain', 'lose', 'maintain')),
  add column onboarded_at timestamptz;

-- Accounts created before onboarding existed already have a plan.
update public.profiles set onboarded_at = coalesce(seeded_at, created_at) where onboarded_at is null;

alter table public.exercises add column catalog_id text;

-- One copy of each catalog exercise per account.
create unique index exercises_user_catalog_key on public.exercises (user_id, catalog_id) where catalog_id is not null;
