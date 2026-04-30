import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { ensurePublicBucket } from '@/lib/supabaseAdmin';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

function isMissingTableMessage(message: string) {
  return /schema cache|could not find the table/i.test(message);
}

function isMissingPriorityPhotosColumnMessage(message: string) {
  return /priority_photo_paths|priority_photo_details/i.test(message) && /column|schema cache/i.test(message);
}

function normalizeStoredPaths(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((entry) => String(entry).trim())
        .filter(Boolean),
    ),
  );
}

function normalizePriorityPhotoDetails(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Map(
      value
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;

          const path = String((entry as { path?: unknown }).path ?? '').trim();
          if (!path) return null;

          const title = String((entry as { title?: unknown }).title ?? '').trim();
          const description = String((entry as { description?: unknown }).description ?? '').trim();

          return [
            path,
            {
              path,
              title: title || null,
              description: description || null,
            },
          ] as const;
        })
        .filter((entry): entry is readonly [string, { path: string; title: string | null; description: string | null }] => Boolean(entry)),
    ).values(),
  );
}

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: 'Demo profile rows use placeholder IDs. Seed Supabase to upload scrolling photos to real UUID-backed profiles.' },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const priorityPhotos = formData.getAll('priority_photos');
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();

    if (!priorityPhotos.some((entry) => entry instanceof File && entry.size > 0)) {
      return NextResponse.json({ error: 'Choose at least one scrolling photo to upload.' }, { status: 400 });
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ?? 'yearbook-media';
    const admin = await ensurePublicBucket(bucketName);

    const profileLookup = await admin
      .from('profiles')
      .select('id, priority_photo_paths, priority_photo_details')
      .eq('id', id)
      .single();

    if (profileLookup.error) {
      if (isMissingPriorityPhotosColumnMessage(profileLookup.error.message)) {
        return NextResponse.json(
          { error: 'The public.profiles priority_photo_paths column is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }

      if (isMissingTableMessage(profileLookup.error.message)) {
        return NextResponse.json(
          { error: 'The public.profiles table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }

      return NextResponse.json({ error: profileLookup.error.message }, { status: 500 });
    }

    const existingPaths = normalizeStoredPaths((profileLookup.data as { priority_photo_paths?: unknown }).priority_photo_paths);
    const existingDetails = normalizePriorityPhotoDetails(
      (profileLookup.data as { priority_photo_details?: unknown }).priority_photo_details,
    );
    const uploadedPaths: string[] = [];
    const uploadedDetails: Array<{ path: string; title: string | null; description: string | null }> = [];

    for (const fileEntry of priorityPhotos) {
      if (!(fileEntry instanceof File) || fileEntry.size <= 0) continue;

      const ext = fileEntry.name.split('.').pop() || 'jpg';
      const filePath = `profiles/highlights/${crypto.randomUUID()}.${ext}`;
      const arrayBuffer = await fileEntry.arrayBuffer();

      const { error: uploadError } = await admin.storage.from(bucketName).upload(filePath, arrayBuffer, {
        contentType: fileEntry.type || 'image/jpeg',
        upsert: false,
      });

      if (uploadError) {
        if (uploadedPaths.length) {
          await admin.storage.from(bucketName).remove(uploadedPaths);
        }
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      uploadedPaths.push(filePath);
      uploadedDetails.push({
        path: filePath,
        title: title || fileEntry.name || null,
        description: description || null,
      });
    }

    const nextPaths = Array.from(new Set([...existingPaths, ...uploadedPaths]));
    const nextDetails = Array.from(
      new Map(
        [...existingDetails, ...uploadedDetails].map((entry) => [entry.path, entry] as const),
      ).values(),
    );

    const { data, error } = await admin
      .from('profiles')
      .update({
        priority_photo_paths: nextPaths,
        priority_photo_details: nextDetails,
      })
      .eq('id', id)
      .select('id, full_name, role, batch, quote, story, photo_path, priority_photo_paths, priority_photo_details')
      .single();

    if (error) {
      if (uploadedPaths.length) {
        await admin.storage.from(bucketName).remove(uploadedPaths);
      }

      if (isMissingPriorityPhotosColumnMessage(error.message)) {
        return NextResponse.json(
          { error: 'The public.profiles priority_photo_paths column is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }

      if (isMissingTableMessage(error.message)) {
        return NextResponse.json(
          { error: 'The public.profiles table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateTag('profiles');
    revalidateTag('home-counts');

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 });
    }

    const { details } = (await request.json()) as {
      details: Array<{ path: string; title: string | null; description: string | null }>;
    };

    if (!Array.isArray(details)) {
      return NextResponse.json({ error: 'Details must be an array' }, { status: 400 });
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ?? 'yearbook-media';
    const admin = await ensurePublicBucket(bucketName);

    // Fetch existing to find which ones to delete from storage
    const current = await admin
      .from('profiles')
      .select('priority_photo_paths')
      .eq('id', id)
      .single();

    if (!current.error && current.data) {
      const oldPaths = normalizeStoredPaths((current.data as { priority_photo_paths?: unknown }).priority_photo_paths);
      const nextPaths = details.map((d) => d.path);
      const toDelete = oldPaths.filter((path) => !nextPaths.includes(path));

      if (toDelete.length) {
        await admin.storage.from(bucketName).remove(toDelete);
      }
    }

    const { data, error } = await admin
      .from('profiles')
      .update({
        priority_photo_paths: details.map((d) => d.path),
        priority_photo_details: details,
      })
      .eq('id', id)
      .select('id, priority_photo_paths, priority_photo_details')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidateTag('profiles');
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
