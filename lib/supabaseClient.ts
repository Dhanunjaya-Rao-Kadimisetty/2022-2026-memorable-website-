import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export type YearbookProfile = {
  id: string;
  full_name: string;
  role: string | null;
  batch: string | null;
  quote: string | null;
  story: string | null;
  photo_path: string | null;
  priority_photo_paths: string[];
  priority_photo_details: Array<{
    path: string;
    title: string | null;
    description: string | null;
  }>;
  photoUrl: string;
  priorityPhotoUrls: string[];
  blurDataURL: string;
};

export type GalleryImage = {
  id: string;
  title: string;
  category: '1st Year' | 'Events' | 'Farewell' | string;
  storage_path: string | null;
  mediaType: 'image' | 'video';
  tagged_profile_ids: string[];
  width: number | null;
  height: number | null;
  alt_text: string | null;
  photoUrl: string;
  blurDataURL: string;
};

export type MessageNote = {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
};

export type HomeCounts = {
  profiles: number;
  memories: number;
  messages: number;
};

function isMissingTableError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? '';
  return /schema cache|could not find the table/i.test(message);
}

function tableSetupMessage(tableName: string) {
  return `The Supabase table ${tableName} is missing. Run supabase/seed.sql in the Supabase SQL editor.`;
}

type AdminCollectionsResponse = {
  profiles?: YearbookProfile[];
  gallery?: GalleryImage[];
  counts?: HomeCounts;
  error?: string;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: 'no-store' });
  const payload = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(
      typeof payload === 'object' && payload && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? ((payload as { error: string }).error)
        : `Request failed for ${path}`,
    );
  }

  return payload;
}

export async function fetchProfiles(): Promise<YearbookProfile[]> {
  const payload = await fetchJson<AdminCollectionsResponse>('/api/public/collections');
  return payload.profiles ?? [];
}

export async function fetchGalleryImages(): Promise<GalleryImage[]> {
  const payload = await fetchJson<AdminCollectionsResponse>('/api/public/collections');
  return payload.gallery ?? [];
}

export async function fetchMessages(): Promise<MessageNote[]> {
  const payload = await fetchJson<{ messages?: MessageNote[]; error?: string }>('/api/messages');
  return payload.messages ?? [];
}

export async function fetchHomeCounts(): Promise<HomeCounts> {
  const payload = await fetchJson<AdminCollectionsResponse>('/api/public/collections');
  return payload.counts ?? { profiles: 0, memories: 0, messages: 0 };
}

export async function postMessage(input: { author_name: string; content: string }) {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      author_name: input.author_name.trim(),
      content: input.content.trim(),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { data?: MessageNote; error?: string };

  if (!response.ok) {
    return {
      data: null,
      error: new Error(payload.error || 'Message submission failed'),
    };
  }

  return {
    data: payload.data ?? null,
    error: null,
  };
}

export async function createProfile(input: {
  full_name: string;
  role?: string;
  batch?: string;
  quote?: string;
  story?: string;
  photo_path?: string;
}) {
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured.'),
    };
  }

  const response = await supabase
    .from('profiles')
    .insert({
      full_name: input.full_name.trim(),
      role: input.role?.trim() || null,
      batch: input.batch?.trim() || null,
      quote: input.quote?.trim() || null,
      story: input.story?.trim() || null,
      photo_path: input.photo_path?.trim() || null,
    })
    .select('id, full_name, role, batch, quote, story, photo_path')
    .single();

  if (response.error && isMissingTableError(response.error)) {
    return {
      data: null,
      error: new Error(tableSetupMessage('public.profiles')),
    };
  }

  return response;
}

export async function createGalleryImage(input: {
  title: string;
  category: string;
  storage_path: string;
  tagged_profile_ids?: string[];
  alt_text?: string;
  width?: number;
  height?: number;
}) {
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase is not configured.'),
    };
  }

  const response = await supabase
    .from('gallery_images')
    .insert({
      title: input.title.trim(),
      category: input.category.trim(),
      storage_path: input.storage_path.trim(),
      alt_text: input.alt_text?.trim() || null,
      width: input.width ?? null,
      height: input.height ?? null,
    })
    .select('id, title, category, storage_path, width, height, alt_text')
    .single();

  if (response.error && isMissingTableError(response.error)) {
    return {
      data: null,
      error: new Error(tableSetupMessage('public.gallery_images')),
    };
  }

  return response;
}

export function subscribeToMessages(onInsert: (message: MessageNote) => void) {
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel('messages-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => onInsert(payload.new as MessageNote),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
