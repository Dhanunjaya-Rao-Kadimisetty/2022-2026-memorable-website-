import { unstable_cache } from 'next/cache';
import { fetchGalleryImages, fetchHomeCounts, fetchMessages, fetchProfiles } from '@/lib/supabaseClient';

export const getProfilesCached = unstable_cache(fetchProfiles, ['profiles'], {
  tags: ['profiles'],
  revalidate: 120,
});

export const getGalleryImagesCached = unstable_cache(fetchGalleryImages, ['gallery-images'], {
  tags: ['gallery-images'],
  revalidate: 120,
});

export const getMessagesCached = unstable_cache(fetchMessages, ['messages'], {
  tags: ['messages'],
  revalidate: 60,
});

export const getHomeCountsCached = unstable_cache(fetchHomeCounts, ['home-counts'], {
  tags: ['home-counts'],
  revalidate: 60,
});
