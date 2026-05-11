-- Table to store push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription_json jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS Policies
alter table public.push_subscriptions enable row level security;

drop policy if exists "Allow public to insert subscriptions" on public.push_subscriptions;
create policy "Allow public to insert subscriptions"
  on public.push_subscriptions
  for insert
  with check (true);

-- We don't want people to read others' subscriptions
drop policy if exists "Only authenticated can read subscriptions" on public.push_subscriptions;
create policy "Only authenticated can read subscriptions"
  on public.push_subscriptions
  for select
  using (auth.role() = 'authenticated');
