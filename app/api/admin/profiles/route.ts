import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createBlurDataURL } from '@/lib/image-utils';
import { ensurePublicBucket } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function isMissingTableMessage(message: string) {
  return /schema cache|could not find the table/i.test(message);
}

function isMissingPriorityPhotosColumnMessage(message: string) {
  return /priority_photo_paths|priority_photo_details|whatsapp_url|instagram_url|snapchat_url|twitter_url|birthday|photo_alignment/i.test(message) && /column|schema cache/i.test(message);
}

export async function POST(request: Request) {
  try {
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
    const photo = formData.get('photo');
    const priorityPhotos = formData.getAll('priority_photos');

    if (!full_name) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ?? 'yearbook-media';
    const admin = await ensurePublicBucket(bucketName);
    let photo_path = '';
    const priority_photo_paths: string[] = [];

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
      .insert({
        full_name,
        role: role || null,
        batch: batch || null,
        quote: quote || null,
        story: story || null,
        photo_path: photo_path || null,
        priority_photo_paths,
        priority_photo_details: [],
        whatsapp_url: whatsapp_url || null,
        instagram_url: instagram_url || null,
        snapchat_url: snapchat_url || null,
        twitter_url: twitter_url || null,
        birthday: birthday || null,
        photo_alignment: photo_alignment || 'center',
      })
      .select('id, full_name, role, batch, quote, story, photo_path, priority_photo_paths, priority_photo_details, whatsapp_url, instagram_url, snapchat_url, twitter_url, birthday, photo_alignment')
      .single();

    if (response.error && isMissingPriorityPhotosColumnMessage(response.error.message)) {
      if (priority_photo_paths.length) {
        await admin.storage.from(bucketName).remove(priority_photo_paths);
      }

      response = await admin
        .from('profiles')
        .insert({
          full_name,
          role: role || null,
          batch: batch || null,
          quote: quote || null,
          story: story || null,
          photo_path: photo_path || null,
        })
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

    return NextResponse.json({
      data,
      blurDataURL: createBlurDataURL('rgba(255,255,255,0.2)'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
