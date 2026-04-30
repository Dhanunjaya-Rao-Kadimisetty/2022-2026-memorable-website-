import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { ensurePublicBucket } from '@/lib/supabaseAdmin';
import { isUuid } from '@/lib/utils';

export const runtime = 'nodejs';

function isMissingTableMessage(message: string) {
  return /schema cache|could not find the table/i.test(message);
}

function isMissingPriorityPhotosColumnMessage(message: string) {
  return /priority_photo_paths|priority_photo_details|whatsapp_url|instagram_url|snapchat_url|twitter_url|birthday|photo_alignment/i.test(message) && /column|schema cache/i.test(message);
}

function parseStoredPaths(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return Array.from(
      new Set(
        parsed
          .map((entry) => String(entry).trim())
          .filter(Boolean),
      ),
    );
  } catch {
    return [];
  }
}

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: 'Demo profile rows use placeholder IDs. Seed Supabase to edit or delete real UUID-backed profiles.' },
        { status: 400 },
      );
    }
    const formData = await request.formData();
    const full_name = String(formData.get('full_name') ?? '').trim();
    const role = String(formData.get('role') ?? '').trim();
    const batch = String(formData.get('batch') ?? '').trim();
    const quote = String(formData.get('quote') ?? '').trim();
    const story = String(formData.get('story') ?? '').trim();
    const whatsapp_url = String(formData.get('whatsapp_url') ?? '').trim();
    const instagram_url = String(formData.get('instagram_url') ?? '').trim();
    const snapchat_url = String(formData.get('snapchat_url') ?? '').trim();
    const twitter_url = String(formData.get('twitter_url') ?? '').trim();
    const birthday = String(formData.get('birthday') ?? '').trim();
    const photo_alignment = String(formData.get('photo_alignment') ?? 'center').trim();
    const current_photo_path = String(formData.get('current_photo_path') ?? '').trim();
    const current_priority_photo_paths = parseStoredPaths(formData.get('current_priority_photo_paths'));
    const photo = formData.get('photo');
    const priorityPhotos = formData.getAll('priority_photos');

    if (!full_name) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ?? 'yearbook-media';
    const admin = await ensurePublicBucket(bucketName);
    let photo_path = current_photo_path || null;
    let priority_photo_paths = [...current_priority_photo_paths];

    if (!current_priority_photo_paths.length) {
      const existingProfile = await admin
        .from('profiles')
        .select('priority_photo_paths')
        .eq('id', id)
        .single();

      if (!existingProfile.error) {
        priority_photo_paths = parseStoredPaths(JSON.stringify((existingProfile.data as { priority_photo_paths?: unknown }).priority_photo_paths ?? []));
      }
    }

    if (photo instanceof File && photo.size > 0) {
      const ext = photo.name.split('.').pop() || 'jpg';
      const filePath = `profiles/${crypto.randomUUID()}.${ext}`;
      const arrayBuffer = await photo.arrayBuffer();

      const { error: uploadError } = await admin.storage.from(bucketName).upload(filePath, arrayBuffer, {
          contentType: photo.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      if (current_photo_path) {
        await admin.storage.from(bucketName).remove([current_photo_path]);
      }

      photo_path = filePath;
    }

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
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      priority_photo_paths.push(filePath);
    }

    let response = await admin
      .from('profiles')
      .update({
        full_name,
        role: role || null,
        batch: batch || null,
        quote: quote || null,
        story: story || null,
        photo_path,
        priority_photo_paths,
        whatsapp_url: whatsapp_url || null,
        instagram_url: instagram_url || null,
        snapchat_url: snapchat_url || null,
        twitter_url: twitter_url || null,
        birthday: birthday || null,
        photo_alignment: photo_alignment || 'center',
      })
      .eq('id', id)
      .select('id, full_name, role, batch, quote, story, photo_path, priority_photo_paths, priority_photo_details, whatsapp_url, instagram_url, snapchat_url, twitter_url, birthday, photo_alignment')
      .single();

    if (response.error && isMissingPriorityPhotosColumnMessage(response.error.message)) {
      const newPriorityPaths = priority_photo_paths.filter((path) => !current_priority_photo_paths.includes(path));
      if (newPriorityPaths.length) {
        await admin.storage.from(bucketName).remove(newPriorityPaths);
      }

      response = await admin
        .from('profiles')
        .update({
          full_name,
          role: role || null,
          batch: batch || null,
          quote: quote || null,
          story: story || null,
          photo_path,
        })
        .eq('id', id)
        .select('id, full_name, role, batch, quote, story, photo_path')
        .single();
    }

    const { data, error } = response;

    if (error) {
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

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: 'Demo profile rows use placeholder IDs. Seed Supabase to edit or delete real UUID-backed profiles.' },
        { status: 400 },
      );
    }
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ?? 'yearbook-media';
    const admin = await ensurePublicBucket(bucketName);

    let profileLookup = await admin
      .from('profiles')
        .select('photo_path, priority_photo_paths, priority_photo_details')
      .eq('id', id)
      .single();

    if (profileLookup.error && isMissingPriorityPhotosColumnMessage(profileLookup.error.message)) {
      profileLookup = await admin.from('profiles').select('photo_path').eq('id', id).single();
    }

    const { data: profile, error: profileLookupError } = profileLookup;

    if (profileLookupError) {
      if (isMissingTableMessage(profileLookupError.message)) {
        return NextResponse.json(
          { error: 'The public.profiles table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: profileLookupError.message }, { status: 500 });
    }

    const { error } = await admin.from('profiles').delete().eq('id', id);
    if (error) {
      if (isMissingTableMessage(error.message)) {
        return NextResponse.json(
          { error: 'The public.profiles table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (profile?.photo_path) {
      await admin.storage.from(bucketName).remove([profile.photo_path]);
    }

    const priorityPhotoPaths = Array.from(
      new Set(
        Array.isArray((profile as { priority_photo_paths?: unknown } | null)?.priority_photo_paths)
          ? ((profile as { priority_photo_paths?: unknown }).priority_photo_paths as unknown[])
              .map((entry) => String(entry).trim())
              .filter(Boolean)
          : [],
      ),
    );
    if (priorityPhotoPaths.length) {
      await admin.storage.from(bucketName).remove(priorityPhotoPaths);
    }

    revalidateTag('profiles');
    revalidateTag('home-counts');

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
