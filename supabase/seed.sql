create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public)
values
  ('yearbook-media', 'yearbook-media', true),
  ('yearbook-gallery', 'yearbook-gallery', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text,
  batch text,
  quote text,
  story text,
  photo_path text,
  priority_photo_paths jsonb not null default '[]'::jsonb,
  priority_photo_details jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.profiles
  add column if not exists priority_photo_paths jsonb not null default '[]'::jsonb;

alter table if exists public.profiles
  add column if not exists priority_photo_details jsonb not null default '[]'::jsonb;

create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  storage_path text not null,
  tagged_profile_ids jsonb not null default '[]'::jsonb,
  alt_text text,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

alter table if exists public.gallery_images
  add column if not exists tagged_profile_ids jsonb not null default '[]'::jsonb;

create table if not exists public.face_detections (
  id uuid primary key default gen_random_uuid(),
  gallery_image_id uuid not null references public.gallery_images(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  detection_index integer not null default 0,
  frame_index integer,
  bounding_box jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  status text not null default 'pending',
  source text not null default 'browser-face-detector',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.face_detections
  add column if not exists frame_index integer;

create index if not exists face_detections_gallery_image_id_idx
  on public.face_detections (gallery_image_id);

create index if not exists face_detections_status_idx
  on public.face_detections (status);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.face_detections (
  id uuid primary key default gen_random_uuid(),
  gallery_image_id uuid not null references public.gallery_images(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  detection_index integer not null default 0,
  frame_index integer,
  bounding_box jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  status text not null default 'pending',
  source text not null default 'browser-face-detector',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists face_detections_gallery_image_id_idx
  on public.face_detections (gallery_image_id);

create index if not exists face_detections_status_idx
  on public.face_detections (status);

alter table if exists public.profiles enable row level security;
alter table if exists public.gallery_images enable row level security;
alter table if exists public.face_detections enable row level security;
alter table if exists public.messages enable row level security;

drop policy if exists "Public read profiles" on public.profiles;
drop policy if exists "Authenticated write profiles" on public.profiles;
create policy "Public read profiles"
  on public.profiles
  for select
  using (true);
create policy "Authenticated write profiles"
  on public.profiles
  for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated update profiles"
  on public.profiles
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy "Authenticated delete profiles"
  on public.profiles
  for delete
  using (auth.role() = 'authenticated');

drop policy if exists "Public read gallery" on public.gallery_images;
drop policy if exists "Authenticated write gallery" on public.gallery_images;
create policy "Public read gallery"
  on public.gallery_images
  for select
  using (true);
create policy "Authenticated write gallery"
  on public.gallery_images
  for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated update gallery"
  on public.gallery_images
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy "Authenticated delete gallery"
  on public.gallery_images
  for delete
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated read face detections" on public.face_detections;
drop policy if exists "Authenticated write face detections" on public.face_detections;
create policy "Authenticated read face detections"
  on public.face_detections
  for select
  using (auth.role() = 'authenticated');
create policy "Authenticated write face detections"
  on public.face_detections
  for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated update face detections"
  on public.face_detections
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy "Authenticated delete face detections"
  on public.face_detections
  for delete
  using (auth.role() = 'authenticated');

drop policy if exists "Public read messages" on public.messages;
drop policy if exists "Public write messages" on public.messages;
create policy "Public read messages"
  on public.messages
  for select
  using (true);
create policy "Public write messages"
  on public.messages
  for insert
  with check (true);

drop policy if exists "Public read media objects" on storage.objects;
drop policy if exists "Authenticated write media objects" on storage.objects;
create policy "Public read media objects"
  on storage.objects
  for select
  using (bucket_id in ('yearbook-media', 'yearbook-gallery'));
create policy "Authenticated write media objects"
  on storage.objects
  for insert
  with check (bucket_id in ('yearbook-media', 'yearbook-gallery') and auth.role() = 'authenticated');
create policy "Authenticated update media objects"
  on storage.objects
  for update
  using (bucket_id in ('yearbook-media', 'yearbook-gallery') and auth.role() = 'authenticated')
  with check (bucket_id in ('yearbook-media', 'yearbook-gallery') and auth.role() = 'authenticated');
create policy "Authenticated delete media objects"
  on storage.objects
  for delete
  using (bucket_id in ('yearbook-media', 'yearbook-gallery') and auth.role() = 'authenticated');
