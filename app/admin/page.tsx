'use client';

import { createBrowserClient } from '@supabase/ssr';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { type GalleryImage, type MessageNote, type YearbookProfile } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

type UploadState = {
  loading: boolean;
  message: string;
  error: string;
};

type EditingProfile = YearbookProfile | null;
type EditingGallery = GalleryImage | null;

const initialState: UploadState = {
  loading: false,
  message: '',
  error: '',
};

export default function AdminPage() {
  const router = useRouter();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const browserSupabase =
    supabaseUrl && supabaseAnonKey ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null;

  const [profileState, setProfileState] = useState<UploadState>(initialState);
  const [priorityPhotoState, setPriorityPhotoState] = useState<UploadState>(initialState);
  const [galleryState, setGalleryState] = useState<UploadState>(initialState);
  const [messageState, setMessageState] = useState<UploadState>(initialState);
  const [profiles, setProfiles] = useState<YearbookProfile[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [messages, setMessages] = useState<MessageNote[]>([]);
  const [editingProfile, setEditingProfile] = useState<EditingProfile>(null);
  const [editingGallery, setEditingGallery] = useState<EditingGallery>(null);
  const [selectedPriorityProfileId, setSelectedPriorityProfileId] = useState('');
  const [selectedTaggedProfileIds, setSelectedTaggedProfileIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/admin/collections', { cache: 'no-store' });
        const payload = (await response.json()) as {
          profiles?: YearbookProfile[];
          gallery?: GalleryImage[];
          messages?: MessageNote[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(getMessage(payload.error) || 'Could not load Supabase data. Check your database and environment settings.');
        }

        if (!active) return;
        setProfiles(payload.profiles ?? []);
        setGallery(payload.gallery ?? []);
        setMessages(payload.messages ?? []);
        setLoadError('');
      } catch (error) {
        if (!active) return;
        setProfiles([]);
        setGallery([]);
        setMessages([]);
        setLoadError(getMessage(error) || 'Could not load Supabase data. Check your database and environment settings.');
      } finally {
        if (active) {
          setCollectionsLoaded(true);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const profileFormKey = editingProfile?.id ?? 'new-profile';
  const galleryFormKey = editingGallery?.id ?? 'new-gallery';
  const profileLookup = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const selectedTaggedProfiles = useMemo(
    () =>
      selectedTaggedProfileIds
        .map((id) => profileLookup.get(id))
        .filter((profile): profile is YearbookProfile => Boolean(profile)),
    [profileLookup, selectedTaggedProfileIds],
  );
  const selectedPriorityProfile = useMemo(
    () => (selectedPriorityProfileId ? profileLookup.get(selectedPriorityProfileId) ?? null : null),
    [profileLookup, selectedPriorityProfileId],
  );
  const adminReady = collectionsLoaded;

  async function refreshCollections() {
    const response = await fetch('/api/admin/collections', { cache: 'no-store' });
    const payload = (await response.json()) as {
      profiles?: YearbookProfile[];
      gallery?: GalleryImage[];
      messages?: MessageNote[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(getMessage(payload.error) || 'Could not load Supabase data. Check your database and environment settings.');
    }

    setProfiles(payload.profiles ?? []);
    setGallery(payload.gallery ?? []);
    setMessages(payload.messages ?? []);
    setLoadError('');
  }

  function formatTaggedPeople(ids: string[]) {
    return ids
      .map((id) => profileLookup.get(id)?.full_name)
      .filter((name): name is string => Boolean(name));
  }

  async function submitProfile(form: HTMLFormElement) {
    setProfileState({ loading: true, message: '', error: '' });

    try {
      const formData = new FormData(form);
      const profileName = String(formData.get('full_name') ?? '').trim();
      const endpoint = editingProfile ? `/api/admin/profiles/${editingProfile.id}` : '/api/admin/profiles';
      const response = await fetch(endpoint, {
        method: editingProfile ? 'PATCH' : 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setProfileState({ loading: false, message: '', error: getMessage(payload.error) || 'Upload failed' });
        return;
      }

      form.reset();
      setProfileState({
        loading: false,
        message: profileName ? `Saved profile: ${profileName}.` : 'Saved profile successfully.',
        error: '',
      });
      setEditingProfile(null);
      setEditingGallery(null);
      await refreshCollections();
    } catch (error) {
      setProfileState({ loading: false, message: '', error: getMessage(error) || 'Upload failed' });
    }
  }

  async function submitPriorityPhotos(form: HTMLFormElement) {
    setPriorityPhotoState({ loading: true, message: '', error: '' });

    try {
      const formData = new FormData(form);
      const profileId = String(formData.get('profile_id') ?? '').trim();

      if (!profileId) {
        setPriorityPhotoState({ loading: false, message: '', error: 'Choose a profile before uploading scrolling photos.' });
        return;
      }

      const response = await fetch(`/api/admin/profiles/${profileId}/priority-photos`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPriorityPhotoState({
          loading: false,
          message: '',
          error: getMessage(payload.error) || 'Could not upload scrolling photos.',
        });
        return;
      }

      form.reset();
      setPriorityPhotoState({
        loading: false,
        message: selectedPriorityProfile
          ? `Uploaded scrolling photos for ${selectedPriorityProfile.full_name}.`
          : 'Uploaded scrolling photos successfully.',
        error: '',
      });
      await refreshCollections();
    } catch (error) {
      setPriorityPhotoState({
        loading: false,
        message: '',
        error: getMessage(error) || 'Could not upload scrolling photos.',
      });
    }
  }

  async function submitGallery(form: HTMLFormElement) {
    setGalleryState({ loading: true, message: '', error: '' });

    try {
      const formData = new FormData(form);
      const taggedCount = selectedTaggedProfileIds.length;
      const taggedNames = selectedTaggedProfiles.map((profile) => profile.full_name);
      const endpoint = editingGallery ? `/api/admin/gallery/${editingGallery.id}` : '/api/admin/gallery';
      const response = await fetch(endpoint, {
        method: editingGallery ? 'PATCH' : 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGalleryState({ loading: false, message: '', error: getMessage(payload.error) || 'Upload failed' });
        return;
      }

      form.reset();
      setGalleryState({
        loading: false,
        message: taggedCount
          ? `Saved successfully. Tagged ${taggedNames.join(', ')}.`
          : 'Saved successfully. No people tagged.',
        error: '',
      });
      setEditingProfile(null);
      setEditingGallery(null);
      await refreshCollections();
    } catch (error) {
      setGalleryState({ loading: false, message: '', error: getMessage(error) || 'Upload failed' });
    }
  }

  async function deleteProfile(profile: YearbookProfile) {
    setProfileState({ loading: true, message: '', error: '' });
    try {
      const response = await fetch(`/api/admin/profiles/${profile.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_path: profile.photo_path }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileState({ loading: false, message: '', error: getMessage(payload.error) || 'Delete failed' });
        return;
      }

      await refreshCollections();
      setProfileState({ loading: false, message: 'Profile deleted.', error: '' });
      if (editingProfile?.id === profile.id) setEditingProfile(null);
    } catch (error) {
      setProfileState({ loading: false, message: '', error: getMessage(error) || 'Delete failed' });
    }
  }

  async function deleteGallery(item: GalleryImage) {
    setGalleryState({ loading: true, message: '', error: '' });
    try {
      const response = await fetch(`/api/admin/gallery/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: item.storage_path }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGalleryState({ loading: false, message: '', error: getMessage(payload.error) || 'Delete failed' });
        return;
      }

      await refreshCollections();
      setGalleryState({ loading: false, message: 'Gallery item deleted.', error: '' });
      if (editingGallery?.id === item.id) setEditingGallery(null);
    } catch (error) {
      setGalleryState({ loading: false, message: '', error: getMessage(error) || 'Delete failed' });
    }
  }

  async function deleteMessage(message: MessageNote) {
    setMessageState({ loading: true, message: '', error: '' });
    try {
      const response = await fetch(`/api/admin/messages/${message.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessageState({ loading: false, message: '', error: getMessage(payload.error) || 'Delete failed' });
        return;
      }

      await refreshCollections();
      setMessageState({ loading: false, message: 'Wall note deleted.', error: '' });
    } catch (error) {
      setMessageState({ loading: false, message: '', error: getMessage(error) || 'Delete failed' });
    }
  }

  const profileHeading = useMemo(
    () => (editingProfile ? `Edit ${editingProfile.full_name}` : 'Add Profile'),
    [editingProfile],
  );
  const galleryHeading = useMemo(
    () => (editingGallery ? `Edit ${editingGallery.title}` : 'Add Gallery Memory'),
    [editingGallery],
  );

  useEffect(() => {
    const validProfileIds = new Set(profiles.map((profile) => profile.id));
    setSelectedTaggedProfileIds(
      (editingGallery?.tagged_profile_ids ?? []).filter((id) => validProfileIds.has(id)),
    );
  }, [editingGallery, profiles]);

  useEffect(() => {
    if (selectedPriorityProfileId && !profileLookup.has(selectedPriorityProfileId)) {
      setSelectedPriorityProfileId('');
    }
  }, [profileLookup, selectedPriorityProfileId]);

  function getMessage(value: unknown) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message;
    if (value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string') {
      return (value as { message: string }).message;
    }
    return '';
  }

  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {!adminReady ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-6 sm:p-8">
            <div className="h-4 w-24 rounded-full bg-white/10" />
            <div className="mt-4 h-14 w-3/4 rounded-2xl bg-white/10" />
            <div className="mt-4 h-4 w-full rounded-full bg-white/10" />
            <div className="mt-2 h-4 w-5/6 rounded-full bg-white/10" />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="h-24 rounded-2xl bg-white/10" />
              <div className="h-24 rounded-2xl bg-white/10" />
              <div className="h-24 rounded-2xl bg-white/10" />
            </div>
          </div>
          <div className="grid gap-6">
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
              <div className="h-4 w-24 rounded-full bg-white/10" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full rounded-full bg-white/10" />
                <div className="h-4 w-5/6 rounded-full bg-white/10" />
                <div className="h-4 w-2/3 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
              <div className="h-4 w-20 rounded-full bg-white/10" />
              <div className="mt-4 space-y-4">
                <div className="h-4 w-full rounded-full bg-white/10" />
                <div className="h-4 w-full rounded-full bg-white/10" />
                <div className="h-4 w-3/4 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      ) : (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <div className="panel overflow-hidden p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Admin</p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Submit Yearbook Content</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
            Use this console to upload profiles and gallery entries directly into Supabase. The layout
            is tuned for fast internal editing, with larger hit targets and clear sectioning.
          </p>

          {loadError ? (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4 text-sm text-red-100">
              {loadError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['01', 'Create profile cards'],
              ['02', 'Upload gallery assets'],
              ['03', 'Keep the wall fresh'],
            ].map(([num, label]) => (
              <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">{num}</p>
                <p className="mt-2 text-sm text-zinc-200">{label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={async () => {
              if (browserSupabase) {
                await browserSupabase.auth.signOut();
              }
              router.push('/admin/login');
            }}
            className="mt-6 rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-100 transition hover:bg-white/[0.08]"
          >
            Sign Out
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Quick Tips</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">
              <p>Use square-ish profile photos for a clean editorial grid.</p>
              <p>Set gallery dimensions when you know them so masonry stays stable.</p>
              <p>Upload paths are stored in Supabase and served from public buckets.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Flow</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-sm text-zinc-300">
                <span>Login</span>
                <span>Supabase Auth</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-sm text-zinc-300">
                <span>Profile upload</span>
                <span>Server route</span>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-300">
                <span>Gallery upload</span>
                <span>Server route</span>
              </div>
            </div>
          </div>
        </div>
        </motion.div>
      )}

      <div className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <form
            key={profileFormKey}
            className="panel space-y-4 p-6 sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              void submitProfile(event.currentTarget);
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-white">{profileHeading}</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Main profile photo uploads go to the `yearbook-media` bucket.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Scrolling photos are managed in a separate upload section below.
                </p>
              </div>
              {editingProfile ? (
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-zinc-300"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <input
              name="full_name"
              required
              defaultValue={editingProfile?.full_name ?? ''}
              placeholder="Full name"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <input
              name="role"
              defaultValue={editingProfile?.role ?? ''}
              placeholder="Role"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <input
              name="batch"
              placeholder="Batch"
              defaultValue={editingProfile?.batch ?? 'Batch of 2022-26'}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <textarea
              name="quote"
              placeholder="Legacy quote"
              rows={3}
              defaultValue={editingProfile?.quote ?? ''}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <textarea
              name="story"
              placeholder="Short story"
              rows={4}
              defaultValue={editingProfile?.story ?? ''}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <input type="hidden" name="current_photo_path" defaultValue={editingProfile?.photo_path ?? ''} />
            <input
              name="photo"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-950"
            />
            <button
              type="submit"
              disabled={profileState.loading}
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {profileState.loading ? 'Saving...' : editingProfile ? 'Update Profile' : 'Save Profile'}
            </button>
            {profileState.message ? <p className="text-sm text-emerald-400">{profileState.message}</p> : null}
            {profileState.error ? <p className="text-sm text-red-400">{profileState.error}</p> : null}
          </form>

          <form
            className="panel space-y-4 p-6 sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPriorityPhotos(event.currentTarget);
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-white">Upload Scrolling Photos</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Choose a profile first, then upload one extra photo with its own title and description.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  These uploads do not create media vault items. They stay attached only to the selected profile and appear on that person&apos;s People page section.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPriorityProfileId('')}
                className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-zinc-300"
              >
                Clear
              </button>
            </div>
            <input type="hidden" name="profile_id" value={selectedPriorityProfileId} />
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-zinc-500">Choose Profile</span>
              <select
                value={selectedPriorityProfileId}
                onChange={(event) => setSelectedPriorityProfileId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Select a profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Selected profile</p>
              {selectedPriorityProfile ? (
                <>
                  <p className="mt-2 font-display text-2xl text-white">{selectedPriorityProfile.full_name}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedPriorityProfile.role || 'Yearbook profile'}
                  </p>
                  <p className="mt-3 text-xs text-zinc-500">
                    Existing scrolling photos: {selectedPriorityProfile.priority_photo_details.length}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  Pick the profile name here before uploading any scrolling photos.
                </p>
              )}
            </div>
            <input
              name="title"
              required
              placeholder="Photo title"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <textarea
              name="description"
              rows={3}
              placeholder="Describe this scrolling photo"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <input
              name="priority_photos"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-950"
            />
            <button
              type="submit"
              disabled={priorityPhotoState.loading || !selectedPriorityProfileId}
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {priorityPhotoState.loading ? 'Uploading...' : 'Upload Scrolling Photos'}
            </button>
            {priorityPhotoState.message ? <p className="text-sm text-emerald-400">{priorityPhotoState.message}</p> : null}
            {priorityPhotoState.error ? <p className="text-sm text-red-400">{priorityPhotoState.error}</p> : null}
          </form>
        </div>

        <form
          key={galleryFormKey}
          className="panel space-y-4 p-6 sm:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            void submitGallery(event.currentTarget);
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-white">{galleryHeading}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Upload images or short videos to the `yearbook-gallery` bucket.
              </p>
            </div>
            {editingGallery ? (
              <button
                type="button"
                onClick={() => {
                  setEditingGallery(null);
                  setSelectedTaggedProfileIds([]);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-zinc-300"
              >
                Clear
              </button>
            ) : null}
          </div>
          <input
            name="title"
            required
            defaultValue={editingGallery?.title ?? ''}
            placeholder="Image title"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <input
            name="category"
            list="gallery-occasions"
            required
            defaultValue={editingGallery?.category ?? ''}
            placeholder="Type an occasion or year"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
          />
          <datalist id="gallery-occasions">
            <option value="1st Year" />
            <option value="2nd Year" />
            <option value="3rd Year" />
            <option value="4th Year" />
            <option value="Events" />
            <option value="Farewell" />
          </datalist>
          <p className="text-xs text-zinc-500">
            You can type a custom occasion here instead of choosing from a fixed dropdown.
          </p>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Tagged people</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Mark the people who appear in this photo or video.
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                {selectedTaggedProfileIds.length} selected
              </span>
            </div>
            {selectedTaggedProfiles.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedTaggedProfiles.map((profile) => (
                  <span
                    key={profile.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-zinc-200"
                  >
                    <span>{profile.full_name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTaggedProfileIds((current) => current.filter((id) => id !== profile.id));
                      }}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-200 transition hover:bg-white/20"
                      aria-label={`Remove ${profile.full_name}`}
                    >
                      Remove
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
              {profiles.length ? (
                profiles.map((profile) => (
                  <label
                    key={profile.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="tagged_profile_ids"
                        value={profile.id}
                        checked={selectedTaggedProfileIds.includes(profile.id)}
                        onChange={(event) => {
                          setSelectedTaggedProfileIds((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, profile.id]))
                              : current.filter((id) => id !== profile.id),
                          );
                        }}
                        className="h-4 w-4 rounded border-white/20 bg-black/40 text-white focus:ring-0"
                      />
                      <span>
                        <span className="block font-medium text-white">{profile.full_name}</span>
                        <span className="block text-xs uppercase tracking-[0.2em] text-zinc-500">
                          {profile.role || 'Yearbook profile'}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {profile.batch || ''}
                    </span>
                  </label>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
                  Add profiles first, then tag them in memories.
                </p>
              )}
            </div>
          </div>
          <input
            name="alt_text"
            placeholder="Alt text"
            defaultValue={editingGallery?.alt_text ?? ''}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              name="width"
              type="number"
              min="1"
              placeholder="Width"
              defaultValue={editingGallery?.width ?? ''}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <input
              name="height"
              type="number"
              min="1"
              placeholder="Height"
              defaultValue={editingGallery?.height ?? ''}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>
          <input type="hidden" name="current_storage_path" defaultValue={editingGallery?.storage_path ?? ''} />
          <input
            type="hidden"
            name="tagged_profile_ids_json"
            value={JSON.stringify(selectedTaggedProfileIds)}
          />
          <input
            name="image"
            type="file"
            accept="image/*,video/*"
            className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-950"
          />
          <button
            type="submit"
            disabled={galleryState.loading}
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {galleryState.loading ? 'Saving...' : editingGallery ? 'Update Gallery Item' : 'Save Gallery Item'}
          </button>
          {galleryState.message ? <p className="text-sm text-emerald-400">{galleryState.message}</p> : null}
          {galleryState.error ? <p className="text-sm text-red-400">{galleryState.error}</p> : null}
        </form>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Manage Profiles</p>
              <h3 className="mt-2 font-display text-2xl text-white">{profiles.length} entries</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl text-white">{profile.full_name}</p>
                    <p className="text-sm text-zinc-400">{profile.role}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-500">{profile.batch}</p>
                    <p className="mt-2 text-sm text-zinc-300">
                      Extra hover photos: {profile.priority_photo_details.length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProfile(profile);
                        setSelectedPriorityProfileId(profile.id);
                      }}
                      className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPriorityProfileId(profile.id)}
                      className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300"
                    >
                      Scroll Photos
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteProfile(profile)}
                      className="rounded-full border border-red-400/20 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Manage Gallery</p>
              <h3 className="mt-2 font-display text-2xl text-white">{gallery.length} entries</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {gallery.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl text-white">{item.title}</p>
                    <p className="text-sm text-zinc-400">{item.category}</p>
                    <p className="mt-2 text-sm text-zinc-300">
                      {formatTaggedPeople(item.tagged_profile_ids).length
                        ? `Tagged: ${formatTaggedPeople(item.tagged_profile_ids).join(', ')}`
                        : 'No tagged people yet'}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                      {item.width ?? 'auto'} x {item.height ?? 'auto'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingGallery(item)}
                      className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteGallery(item)}
                      className="rounded-full border border-red-400/20 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="panel p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Manage Wall</p>
              <h3 className="mt-2 font-display text-2xl text-white">{messages.length} notes</h3>
            </div>
          </div>
          {messageState.message ? <p className="mt-4 text-sm text-emerald-400">{messageState.message}</p> : null}
          {messageState.error ? <p className="mt-4 text-sm text-red-400">{messageState.error}</p> : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {messages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{message.author_name}</p>
                    <p className="mt-3 text-sm leading-7 text-zinc-200">{message.content}</p>
                    <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteMessage(message)}
                    disabled={messageState.loading}
                    className="rounded-full border border-red-400/20 px-3 py-2 text-xs uppercase tracking-[0.2em] text-red-300 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!messages.length ? (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
                No wall notes yet.
              </p>
            ) : null}
          </div>
        </div>
      </div>

    </section>
  );
}
