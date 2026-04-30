import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { ensurePublicBucket } from '@/lib/supabaseAdmin';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

type GalleryResponseRow = {
  id: string;
  title: string;
  category: string;
  storage_path: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  tagged_profile_ids?: unknown;
};

function isMissingTableMessage(message: string) {
  return /could not find the table|relation .* does not exist/i.test(message);
}

function inferContentType(file: File) {
  if (file.type) return file.type;

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'mov', 'm4v'].includes(ext)) return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'ogg') return 'video/ogg';
  return 'image/jpeg';
}

function selectedProfileIds(formData: FormData) {
  const serialized = String(formData.get('tagged_profile_ids_json') ?? '').trim();
  if (serialized) {
    try {
      const parsed = JSON.parse(serialized) as unknown;
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((value) => String(value).trim()).filter(Boolean)));
      }
    } catch {
      // Fall back to checkbox serialization below.
    }
  }

  return Array.from(
    new Set(
      formData
        .getAll('tagged_profile_ids')
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
}

function isMissingTagColumnError(message: string) {
  return /tagged_profile_ids/i.test(message) && /column|schema cache/i.test(message);
}

function isUnsupportedFaceDetectionsSchemaError(message: string) {
  return /public\.face_detections|face_detections|source|frame_index|bounding_box|confidence|status/i.test(message)
    && /could not find the table|relation .* does not exist|column .* does not exist|schema cache/i.test(message);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Unknown error';
}

function buildGallerySelect(includeTaggedProfileIds: boolean) {
  return includeTaggedProfileIds
    ? 'id, title, category, storage_path, width, height, alt_text, tagged_profile_ids'
    : 'id, title, category, storage_path, width, height, alt_text';
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

async function persistTaggedProfileIds(
  admin: Awaited<ReturnType<typeof ensurePublicBucket>>,
  galleryImageId: string,
  profileIds: string[],
) {
  const { error } = await admin
    .from('gallery_images')
    .update({ tagged_profile_ids: profileIds })
    .eq('id', galleryImageId);

  if (error && !isMissingTagColumnError(error.message)) {
    throw error;
  }

  return !error;
}

async function syncManualTags(
  admin: Awaited<ReturnType<typeof ensurePublicBucket>>,
  galleryImageId: string,
  profileIds: string[],
) {
  const { error: deleteError } = await admin
    .from('face_detections')
    .delete()
    .eq('gallery_image_id', galleryImageId)
    .eq('source', 'manual-gallery-tag');

  if (deleteError) {
    if (isUnsupportedFaceDetectionsSchemaError(deleteError.message)) {
      return false;
    }
    throw deleteError;
  }

  if (!profileIds.length) {
    return true;
  }

  const { error: insertError } = await admin.from('face_detections').insert(
    profileIds.map((profileId, index) => ({
      gallery_image_id: galleryImageId,
      profile_id: profileId,
      detection_index: index,
      frame_index: null,
      bounding_box: {},
      confidence: null,
      source: 'manual-gallery-tag',
      status: 'matched',
    })),
  );

  if (insertError) {
    if (isUnsupportedFaceDetectionsSchemaError(insertError.message)) {
      return false;
    }
    throw insertError;
  }

  return true;
}

async function syncGalleryTags(
  admin: Awaited<ReturnType<typeof ensurePublicBucket>>,
  galleryImageId: string,
  profileIds: string[],
) {
  const columnPersisted = await persistTaggedProfileIds(admin, galleryImageId, profileIds);
  const detectionsPersisted = await syncManualTags(admin, galleryImageId, profileIds);

  if (!columnPersisted && !detectionsPersisted && profileIds.length) {
    throw new Error(
      'Tagged people could not be saved because the tag storage tables are missing. Run supabase/seed.sql in Supabase.',
    );
  }
}

async function filterExistingProfileIds(
  admin: Awaited<ReturnType<typeof ensurePublicBucket>>,
  profileIds: string[],
) {
  if (!profileIds.length) return [];

  const { data, error } = await admin.from('profiles').select('id').in('id', profileIds);

  if (error) {
    if (isMissingTableMessage(error.message)) {
      throw new Error('The public.profiles table is missing. Run supabase/seed.sql in Supabase.');
    }
    throw error;
  }

  const validIds = new Set((data ?? []).map((profile) => profile.id));
  return profileIds.filter((profileId) => validIds.has(profileId));
}

async function updateGalleryRow(
  admin: Awaited<ReturnType<typeof ensurePublicBucket>>,
  galleryImageId: string,
  values: {
    title: string;
    category: string;
    alt_text: string | null;
    width: number | null;
    height: number | null;
    storage_path: string | null;
    tagged_profile_ids: string[];
  },
) {
  const withTags = await admin
    .from('gallery_images')
    .update(values)
    .eq('id', galleryImageId)
    .select(buildGallerySelect(true))
    .single();

  if (!withTags.error || !isMissingTagColumnError(withTags.error.message)) {
    return withTags;
  }

  return admin
    .from('gallery_images')
    .update({
      title: values.title,
      category: values.category,
      alt_text: values.alt_text,
      width: values.width,
      height: values.height,
      storage_path: values.storage_path,
    })
    .eq('id', galleryImageId)
    .select(buildGallerySelect(false))
    .single();
}

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: 'Demo gallery rows use placeholder IDs. Seed Supabase to edit or delete real UUID-backed memories.' },
        { status: 400 },
      );
    }
    const formData = await request.formData();
    const title = String(formData.get('title') ?? '').trim();
    const category = String(formData.get('category') ?? '').trim();
    const alt_text = String(formData.get('alt_text') ?? '').trim();
    const width = Number(formData.get('width') ?? 0) || null;
    const height = Number(formData.get('height') ?? 0) || null;
    const current_storage_path = String(formData.get('current_storage_path') ?? '').trim();
    const media = formData.get('image');
    const audio = formData.get('audio');
    const taggedProfileIds = selectedProfileIds(formData);

    if (!title || !category) {
      return NextResponse.json({ error: 'title and category are required' }, { status: 400 });
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_GALLERY_BUCKET ?? 'yearbook-gallery';
    const admin = await ensurePublicBucket(bucketName);
    const validTaggedProfileIds = await filterExistingProfileIds(admin, taggedProfileIds);
    let storage_path = current_storage_path || null;

    if (media instanceof File && media.size > 0) {
      const ext = media.name.split('.').pop() || 'jpg';
      const filePath = `gallery/${crypto.randomUUID()}.${ext}`;
      const arrayBuffer = await media.arrayBuffer();
      const contentType = inferContentType(media);

      const { error: uploadError } = await admin.storage.from(bucketName).upload(filePath, arrayBuffer, {
        contentType,
        upsert: false,
      });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      if (current_storage_path) {
        await admin.storage.from(bucketName).remove([current_storage_path]);
      }

      storage_path = filePath;
    }

    let audio_path = String(formData.get('current_audio_path') ?? '').trim() || null;
    if (audio instanceof File && audio.size > 0) {
      const audioExt = audio.name.split('.').pop() || 'mp3';
      const audioFilePath = `music/${crypto.randomUUID()}.${audioExt}`;
      const audioBuffer = await audio.arrayBuffer();
      
      const { error: audioUploadError } = await admin.storage.from('yearbook-music').upload(audioFilePath, audioBuffer, {
        contentType: audio.type || 'audio/mpeg',
        upsert: false,
      });

      if (audioUploadError) {
        console.error('Audio upload error:', audioUploadError);
      } else {
        const currentAudioPath = String(formData.get('current_audio_path') ?? '').trim();
        if (currentAudioPath) {
          await admin.storage.from('yearbook-music').remove([currentAudioPath]);
        }
        audio_path = audioFilePath;
      }
    }

    const { data, error } = await updateGalleryRow(admin, id, {
      title,
      category,
      alt_text: alt_text || null,
      width,
      height,
      storage_path,
      tagged_profile_ids: validTaggedProfileIds,
      audio_path,
    });

    if (error) {
      if (isMissingTableMessage(error.message)) {
        return NextResponse.json(
          { error: 'The public.gallery_images table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await syncGalleryTags(admin, id, validTaggedProfileIds);

    revalidateTag('gallery-images');
    revalidateTag('home-counts');

    const responseData = data as unknown as GalleryResponseRow | null;

    return NextResponse.json({
      data: responseData
        ? {
            ...responseData,
            tagged_profile_ids: Array.from(
              new Set([
                ...normalizeTaggedProfileIds(responseData.tagged_profile_ids),
                ...validTaggedProfileIds,
              ]),
            ),
          }
        : null,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: 'Demo gallery rows use placeholder IDs. Seed Supabase to edit or delete real UUID-backed memories.' },
        { status: 400 },
      );
    }
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_GALLERY_BUCKET ?? 'yearbook-gallery';
    const admin = await ensurePublicBucket(bucketName);

    const { data: galleryItem, error: galleryLookupError } = await admin
      .from('gallery_images')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (galleryLookupError) {
      if (isMissingTableMessage(galleryLookupError.message)) {
        return NextResponse.json(
          { error: 'The public.gallery_images table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: galleryLookupError.message }, { status: 500 });
    }

    const { error } = await admin.from('gallery_images').delete().eq('id', id);
    if (error) {
      if (isMissingTableMessage(error.message)) {
        return NextResponse.json(
          { error: 'The public.gallery_images table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (galleryItem?.storage_path) {
      await admin.storage.from(bucketName).remove([galleryItem.storage_path]);
    }

    revalidateTag('gallery-images');
    revalidateTag('home-counts');

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
