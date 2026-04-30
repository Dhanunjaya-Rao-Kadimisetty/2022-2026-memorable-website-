# Batch 2022-26 Digital Yearbook

A cinematic yearbook experience built with Next.js App Router, Tailwind CSS, Framer Motion, and Supabase.

## Stack

- Next.js App Router
- Tailwind CSS
- Framer Motion
- Supabase Database and Storage
- Next/Image for optimized media

## Folder Structure

```txt
app/
  layout.tsx
  template.tsx
  globals.css
  page.tsx
  admin/page.tsx
  admin/login/page.tsx
  yearbook/page.tsx
  media-vault/page.tsx
  the-wall/page.tsx
components/
  Navbar.tsx
  ProfileCard.tsx
  Skeletons.tsx
lib/
  supabaseClient.ts
  supabaseAdmin.ts
  mock-data.ts
  image-utils.ts
  utils.ts
public/
  grain.svg
  placeholder-profile.svg
  placeholder-gallery.svg
supabase/
  seed.sql
scripts/
  seed-admin-user.mjs
```

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create a `.env.local` file.

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET=yearbook-media
NEXT_PUBLIC_SUPABASE_GALLERY_BUCKET=yearbook-gallery
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_TOTP_SECRET=your_base32_totp_secret
ADMIN_TOTP_ISSUER=Batch 2022-26 Yearbook
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

3. Start the app.

```bash
npm run dev
```

The app now scans for the first free local port starting at `3004`.

```bash
http://localhost:3004
```

If `3004` is already in use, the launcher automatically moves to the next free port.

## Share With ngrok

If you want to show the site to friends before your real deployment, ngrok can expose your local dev server over the internet.

1. Install ngrok from [ngrok.com](https://ngrok.com/) if you do not already have it.
2. Add your authtoken once:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

3. Start the shared tunnel:

```bash
npm run share:ngrok
```

The helper script builds the app, starts the production server on port `3003`, and opens an ngrok tunnel to that port.

This is a temporary share link, not a production deployment. The tunnel works while the local machine is running.
Treat the public URL like a private link, because anyone who has it can open the site while the tunnel is active.

If the tunnel does not start, check `share-build.out.log`, `share-build.err.log`, `share-start.out.log`, and `share-start.err.log` in the project root.

## Admin Login Security

The admin login now supports two extra layers of protection:

1. CAPTCHA with Cloudflare Turnstile
2. Two-step verification with a TOTP authenticator app

To enable them:

1. Create a Turnstile site in the Cloudflare dashboard and copy the site key and secret.
2. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to `.env.local`.
3. Generate a base32 TOTP secret for your authenticator app and add it as `ADMIN_TOTP_SECRET`.
4. You can generate a ready-to-use secret with:

```bash
npm run admin:totp-secret
```

This prints the secret and an `otpauth://` URI you can add to Google Authenticator, Authy, 1Password, or another TOTP app.
5. Keep `ADMIN_EMAIL` set to only your own admin email.

If these values are missing, the login page will warn you that CAPTCHA is not configured, and the server will not allow the two-step flow to complete until the secret is present.
If you leave `ADMIN_TOTP_SECRET` blank, the login will fall back to password-only authentication with the normal captcha and rate limiting.

## Admin Setup Fallback

If the admin page shows a setup banner, add these variables to `.env.local` and restart the dev server.

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Seed the Admin Auth User

The fastest way to create the first protected admin user is to run the seed script:

```bash
npm run seed:admin
```

This uses the Supabase service role key to create a confirmed auth user with the email and password
from your environment variables.

If you prefer the dashboard:

1. Open Supabase Dashboard.
2. Go to Authentication.
3. Open Users.
4. Create a new user manually.
5. Sign in at `/admin/login`.

## Supabase Database

Create these tables in the Supabase SQL editor.

### `profiles`

```sql
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text,
  batch text,
  quote text,
  story text,
  photo_path text,
  created_at timestamptz not null default now()
);
```

### `gallery_images`

```sql
create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  storage_path text not null,
  alt_text text,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
```

### `messages`

```sql
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);
```

## Storage Buckets

Create two public buckets:

1. `yearbook-media` for profile photos
2. `yearbook-gallery` for gallery assets

Upload files into those buckets and store the file paths in `photo_path` or `storage_path`.

## Seed Data

Run the SQL in [`supabase/seed.sql`](./supabase/seed.sql) to create the tables and populate realistic profiles, gallery entries, and wall notes.

## Recommended RLS

```sql
alter table public.profiles enable row level security;
create policy "Public read profiles" on public.profiles for select using (true);

alter table public.gallery_images enable row level security;
create policy "Public read gallery" on public.gallery_images for select using (true);

alter table public.messages enable row level security;
create policy "Public read messages" on public.messages for select using (true);
create policy "Public insert messages" on public.messages for insert with check (true);
```

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add these environment variables in Vercel.

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET
NEXT_PUBLIC_SUPABASE_GALLERY_BUCKET
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
```

4. Deploy.

## Notes

- The landing page keeps client-side motion, but it no longer forces dynamic rendering.
- The yearbook modal uses Framer Motion layout animations.
- Gallery images use `next/image` with `placeholder="blur"` to reduce layout shift.
- The wall page subscribes to Supabase realtime inserts for live message updates.
- The admin page shows a setup state until the Supabase credentials and service role key are available.
- If you see `Could not find the table public.messages in the schema cache`, run [`supabase/seed.sql`](./supabase/seed.sql) in the Supabase SQL editor to create the tables and refresh the schema.
