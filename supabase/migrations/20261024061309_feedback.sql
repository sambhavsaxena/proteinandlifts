-- Feedback sent from the app's Settings → Send feedback, kept with the
-- account that sent it. Users can send and read their own; nobody else can
-- read it through the API.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'idea' check (kind in ('idea', 'problem', 'praise')),
  message text not null check (char_length(message) between 1 and 4000),
  app_version text,
  platform text,
  created_at timestamptz not null default now()
);

create index on public.feedback (user_id);

alter table public.feedback enable row level security;
create policy "feedback: owner insert" on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "feedback: owner read" on public.feedback for select to authenticated
  using ((select auth.uid()) = user_id);
grant select, insert on public.feedback to authenticated;
revoke all on public.feedback from anon;
