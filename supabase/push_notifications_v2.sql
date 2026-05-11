-- Add profile_name column to identify who subscribed
alter table public.push_subscriptions 
add column if not exists profile_name text;

-- Also add profile_id for more robust linking
alter table public.push_subscriptions 
add column if not exists profile_id uuid;
