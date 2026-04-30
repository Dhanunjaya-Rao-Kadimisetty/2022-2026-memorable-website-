import { NextResponse } from 'next/server';
import { createBlurDataURL } from '@/lib/image-utils';
import { ensureAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function isMissingTableMessage(message: string) {
  return /schema cache|could not find the table/i.test(message);
}

function countFromHeadResponse(
  response: { count: number | null; error: { message?: string } | null },
  fallback = 0,
) {
  if (response.error) {
    if (isMissingTableMessage(response.error.message ?? '')) {
      return fallback;
    }
    throw response.error;
  }

  return response.count ?? fallback;
}

function inferMediaType(path: string | null): 'image' | 'video' {
  if (!path) return 'image';

  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(ext) ? 'video' : 'image';
}

function collectTaggedProfileIds(
  detections:
    | Array<{
        gallery_image_id: string;
        profile_id: string | null;
        status: string;
      }>
    | null
    | undefined,
) {
  const tagMap = new Map<string, string[]>();

  for (const detection of detections ?? []) {
    if (detection.status !== 'matched' || !detection.profile_id) continue;

    const tags = tagMap.get(detection.gallery_image_id) ?? [];
    if (!tags.includes(detection.profile_id)) {
      tags.push(detection.profile_id);
      tagMap.set(detection.gallery_image_id, tags);
    }
  }

  return tagMap;
}

function normalizeTaggedProfileIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((entry) => String(entry).trim())
        .filter(Boolean),
    ),
  );
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

function normalizePriorityPhotoDetails(
  value: unknown,
  fallbackPaths: string[],
) {
  if (!Array.isArray(value)) {
    return fallbackPaths.map((path) => ({
      path,
      title: null,
      description: null,
    }));
  }

  const details = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const path = String((entry as { path?: unknown }).path ?? '').trim();
      if (!path) return null;

      const title = String((entry as { title?: unknown }).title ?? '').trim();
      const description = String((entry as { description?: unknown }).description ?? '').trim();

      return {
        path,
        title: title || null,
        description: description || null,
      };
    })
    .filter((entry): entry is { path: string; title: string | null; description: string | null } => Boolean(entry));

  if (!details.length) {
    return fallbackPaths.map((path) => ({
      path,
      title: null,
      description: null,
    }));
  }

  const seen = new Set<string>();
  return details.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

async function fetchProfileRows(admin: ReturnType<typeof ensureAdminClient>) {
  const withPriorityPhotos = await admin
    .from('profiles')
    .select('id, full_name, role, batch, quote, story, photo_path, priority_photo_paths, priority_photo_details, whatsapp_url, instagram_url, snapchat_url, twitter_url, birthday, photo_alignment')
    .order('full_name', { ascending: true });

  if (!withPriorityPhotos.error) {
    return withPriorityPhotos;
  }

  if (/priority_photo_paths|priority_photo_details|whatsapp_url|instagram_url|snapchat_url|twitter_url|birthday|photo_alignment/i.test(withPriorityPhotos.error.message ?? '')) {
    return admin
      .from('profiles')
      .select('id, full_name, role, batch, quote, story, photo_path')
      .order('full_name', { ascending: true });
  }

  return withPriorityPhotos;
}

async function fetchGalleryRows(admin: ReturnType<typeof ensureAdminClient>) {
  const withTags = await admin
    .from('gallery_images')
    .select('id, title, category, storage_path, width, height, alt_text, tagged_profile_ids, audio_path')
    .order('created_at', { ascending: false });

  if (!withTags.error) {
    return withTags;
  }

  if (/tagged_profile_ids|audio_path/i.test(withTags.error.message ?? '')) {
    return admin
      .from('gallery_images')
      .select('id, title, category, storage_path, width, height, alt_text')
      .order('created_at', { ascending: false });
  }

  return withTags;
}

function isMissingFaceDetectionsError(message: string) {
  return /public\.face_detections|face_detections/i.test(message) && isMissingTableMessage(message);
}

export async function GET() {
  try {
    const admin = ensureAdminClient();
    const bucketProfile = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ?? 'yearbook-media';
    const bucketGallery = process.env.NEXT_PUBLIC_SUPABASE_GALLERY_BUCKET ?? 'yearbook-gallery';

    const [profilesResponse, galleryResponse] = await Promise.all([fetchProfileRows(admin), fetchGalleryRows(admin)]);

    if (profilesResponse.error) {
      if (isMissingTableMessage(profilesResponse.error.message)) {
        return jsonNoStore({
          profiles: [],
          gallery: [],
          counts: { profiles: 0, memories: 0, messages: 0 },
        });
      }
      return jsonNoStore({ error: profilesResponse.error.message }, 500);
    }

    if (galleryResponse.error) {
      if (isMissingTableMessage(galleryResponse.error.message)) {
        return jsonNoStore({
          profiles: [],
          gallery: [],
          counts: { profiles: 0, memories: 0, messages: 0 },
        });
      }
      return jsonNoStore({ error: galleryResponse.error.message }, 500);
    }

    const galleryIds = galleryResponse.data?.map((item) => item.id) ?? [];
    const { data: detectionRows, error: detectionError } = galleryIds.length
      ? await admin
          .from('face_detections')
          .select('gallery_image_id, profile_id, status')
          .in('gallery_image_id', galleryIds)
      : { data: [], error: null };

    const [profilesCount, galleryCount, messagesCount] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('gallery_images').select('id', { count: 'exact', head: true }),
      admin.from('messages').select('id', { count: 'exact', head: true }),
    ]);

    if (detectionError && !isMissingFaceDetectionsError(detectionError.message)) {
      return jsonNoStore({ error: detectionError.message }, 500);
    }

    const taggedProfileMap = collectTaggedProfileIds(detectionRows);

    return jsonNoStore({
      profiles:
        profilesResponse.data?.map((profile) => {
          const priorityPhotoPaths = normalizeStoredPaths(
            (profile as { priority_photo_paths?: unknown }).priority_photo_paths,
          );
          const priorityPhotoDetails = normalizePriorityPhotoDetails(
            (profile as { priority_photo_details?: unknown }).priority_photo_details,
            priorityPhotoPaths,
          );

          return {
            ...profile,
            priority_photo_paths: priorityPhotoPaths,
            priority_photo_details: priorityPhotoDetails,
            photoUrl: profile.photo_path
              ? admin.storage.from(bucketProfile).getPublicUrl(profile.photo_path).data.publicUrl
              : '',
            priorityPhotoUrls: priorityPhotoDetails.map(
              (entry) => admin.storage.from(bucketProfile).getPublicUrl(entry.path).data.publicUrl,
            ),
            blurDataURL: createBlurDataURL('rgba(255,255,255,0.2)'),
          };
        }) ?? [],
      gallery:
        galleryResponse.data?.map((image) => ({
          ...image,
          tagged_profile_ids: Array.from(
            new Set([
              ...normalizeTaggedProfileIds((image as { tagged_profile_ids?: unknown }).tagged_profile_ids),
              ...(taggedProfileMap.get(image.id) ?? []),
            ]),
          ),
          mediaType: inferMediaType(image.storage_path),
          photoUrl: image.storage_path
            ? admin.storage.from(bucketGallery).getPublicUrl(image.storage_path).data.publicUrl
            : '',
          audioUrl: ((image as unknown) as { audio_path?: string | null }).audio_path
            ? admin.storage.from('yearbook-music').getPublicUrl(((image as unknown) as { audio_path: string }).audio_path).data.publicUrl
            : '',
          blurDataURL: createBlurDataURL('rgba(255,255,255,0.16)'),
        })) ?? [],
      counts: {
        profiles: countFromHeadResponse(profilesCount),
        memories: countFromHeadResponse(galleryCount),
        messages: countFromHeadResponse(messagesCount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonNoStore({ error: message }, 500);
  }
}
