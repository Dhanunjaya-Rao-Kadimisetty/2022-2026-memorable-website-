import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const ensuredBuckets = new Set<string>();

export function ensureAdminClient() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase admin environment variables are not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return supabaseAdmin;
}

export async function ensurePublicBucket(bucketName: string) {
  const admin = ensureAdminClient();

  if (ensuredBuckets.has(bucketName)) {
    return admin;
  }

  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (!listError && buckets?.some((bucket) => bucket.name === bucketName)) {
    ensuredBuckets.add(bucketName);
    return admin;
  }

  const { error: createError } = await admin.storage.createBucket(bucketName, {
    public: true,
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }

  ensuredBuckets.add(bucketName);
  return admin;
}
