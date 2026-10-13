-- Protein & Lifts schema. Every row is owned by one user; row-level security
-- is the only thing between the public API key and the data.

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  protein_target_g numeric not null default 120,
  gap_alert_g numeric not null default 15,
  progression_reps int not null default 12,
  progression_increment_kg numeric not null default 2.5,
  weight_gain_target_kg_week numeric not null default 0.3,
  active_plan_id uuid,
  seeded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  muscle_group text,
  equipment text,
  instructions text,
  created_at timestamptz not null default now()
);

-- A step photo or a photo of the machine. Starter images live on the site
-- (`url`); uploads live in the private `exercise-media` bucket (`storage_path`).
create table public.exercise_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  kind text not null default 'step' check (kind in ('step', 'machine')),
  url text,
  storage_path text,
  caption text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  notes text,
  rest_seconds int not null default 120,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  alt_exercise_id uuid references public.exercises on delete set null,
  position int not null default 0,
  target_sets int not null default 3,
  rep_min int not null default 8,
  rep_max int not null default 12
);

-- weekday: 0 = Monday … 6 = Sunday. No row means rest day.
create table public.schedule (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  workout_id uuid not null references public.workouts on delete cascade,
  primary key (user_id, weekday)
);

-- Sessions and set logs keep a name snapshot so reports survive the workout
-- or exercise being renamed or deleted later.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid references public.workouts on delete set null,
  workout_name text not null,
  performed_on date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references public.workout_sessions on delete cascade,
  exercise_id uuid references public.exercises on delete set null,
  exercise_name text not null,
  performed_on date not null,
  set_no int not null,
  weight_kg numeric not null default 0,
  reps int not null,
  created_at timestamptz not null default now()
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  serving text not null default '1 serving',
  protein_g numeric not null default 0,
  is_backup boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  variants text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_active_plan_fk
  foreign key (active_plan_id) references public.diet_plans on delete set null;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan_id uuid not null references public.diet_plans on delete cascade,
  name text not null,
  position int not null default 0
);

-- variant null = eaten on every variant of the plan.
create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  meal_id uuid not null references public.meals on delete cascade,
  food_id uuid not null references public.foods on delete cascade,
  qty numeric not null default 1,
  variant text,
  position int not null default 0
);

-- protein_g is the total for the entry (qty already applied), frozen at log time.
create table public.intake_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on date not null,
  food_id uuid references public.foods on delete set null,
  food_name text not null,
  qty numeric not null default 1,
  protein_g numeric not null,
  meal_name text,
  created_at timestamptz not null default now()
);

create table public.weight_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on date not null,
  kg numeric not null check (kg > 0),
  primary key (user_id, logged_on)
);

create index on public.exercises (user_id);
create index on public.exercise_media (user_id);
create index on public.exercise_media (exercise_id);
create index on public.workouts (user_id);
create index on public.workout_exercises (user_id);
create index on public.workout_exercises (workout_id);
create index on public.workout_exercises (exercise_id);
create index on public.workout_exercises (alt_exercise_id);
create index on public.schedule (workout_id);
create index on public.workout_sessions (user_id, performed_on);
create index on public.workout_sessions (workout_id);
create index on public.set_logs (user_id, performed_on);
create index on public.set_logs (session_id);
create index on public.set_logs (exercise_id);
create index on public.foods (user_id);
create index on public.diet_plans (user_id);
create index on public.profiles (active_plan_id);
create index on public.meals (user_id);
create index on public.meals (plan_id);
create index on public.meal_items (user_id);
create index on public.meal_items (meal_id);
create index on public.meal_items (food_id);
create index on public.intake_logs (user_id, logged_on);
create index on public.intake_logs (food_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'exercises', 'exercise_media', 'workouts', 'workout_exercises',
    'schedule', 'workout_sessions', 'set_logs', 'foods', 'diet_plans', 'meals',
    'meal_items', 'intake_logs', 'weight_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-media', 'exercise-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Uploads are stored under "<user id>/…"; the first path segment is the owner.
create policy "exercise media: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'exercise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "exercise media: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "exercise media: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
