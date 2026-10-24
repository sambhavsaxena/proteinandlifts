-- Water drunk through the day: one row per glass (or other amount) logged,
-- from the app's Today screen or its home-screen widget. Rows are kept per
-- glass, not as a daily total, so the last one can be undone.

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  logged_on date not null,
  ml integer not null check (ml > 0 and ml <= 5000),
  source text not null default 'app' check (source in ('app', 'widget')),
  created_at timestamptz not null default now()
);

create index on public.water_logs (user_id, logged_on);

alter table public.water_logs enable row level security;
create policy "owner only" on public.water_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.water_logs to authenticated;
revoke all on public.water_logs from anon;
