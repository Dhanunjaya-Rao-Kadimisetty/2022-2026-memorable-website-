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

interface PushSubscription {
  id: string;
  profile_name: string | null;
  created_at: string;
}

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
  const [notifyState, setNotifyState] = useState<UploadState>(initialState);
  const [profiles, setProfiles] = useState<YearbookProfile[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [messages, setMessages] = useState<MessageNote[]>([]);
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
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
          subscriptions?: PushSubscription[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(getMessage(payload.error) || 'Could not load data.');
        }

        if (!active) return;
        setProfiles(payload.profiles ?? []);
        setGallery(payload.gallery ?? []);
        setMessages(payload.messages ?? []);
        setSubscriptions(payload.subscriptions ?? []);
        setLoadError('');
      } catch (error) {
        if (!active) return;
        setProfiles([]);
        setGallery([]);
        setMessages([]);
        setLoadError(getMessage(error) || 'Could not load data.');
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
      subscriptions?: PushSubscription[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(getMessage(payload.error) || 'Could not load data.');
    }

    setProfiles(payload.profiles ?? []);
    setGallery(payload.gallery ?? []);
    setMessages(payload.messages ?? []);
    setSubscriptions(payload.subscriptions ?? []);
    setLoadError('');
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
        setPriorityPhotoState({ loading: false, message: '', error: 'Choose a profile first.' });
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
          error: getMessage(payload.error) || 'Upload failed',
        });
        return;
      }

      form.reset();
      setPriorityPhotoState({
        loading: false,
        message: 'Scrolling photo uploaded.',
        error: '',
      });
      await refreshCollections();
    } catch (error) {
      setPriorityPhotoState({
        loading: false,
        message: '',
        error: getMessage(error) || 'Upload failed',
      });
    }
  }

  async function updatePriorityPhotoOrder(
    profileId: string,
    details: Array<{ path: string; title: string | null; description: string | null }>,
  ) {
    setPriorityPhotoState({ loading: true, message: '', error: '' });
    try {
      const response = await fetch(`/api/admin/profiles/${profileId}/priority-photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPriorityPhotoState({ loading: false, message: '', error: getMessage(payload.error) || 'Failed to update order' });
        return;
      }

      await refreshCollections();
      setPriorityPhotoState({ loading: false, message: 'Updated photo order.', error: '' });
    } catch (error) {
      setPriorityPhotoState({ loading: false, message: '', error: getMessage(error) || 'Failed to update order' });
    }
  }

  async function submitGallery(form: HTMLFormElement) {
    setGalleryState({ loading: true, message: '', error: '' });

    try {
      const formData = new FormData(form);
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
        message: 'Gallery item saved.',
        error: '',
      });
      setEditingGallery(null);
      await refreshCollections();
    } catch (error) {
      setGalleryState({ loading: false, message: '', error: getMessage(error) || 'Upload failed' });
    }
  }

  async function deleteProfile(profile: YearbookProfile) {
    if (!confirm(`Are you sure you want to delete ${profile.full_name}?`)) return;
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
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return;
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
    if (!confirm('Are you sure you want to delete this wall note?')) return;
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

  async function sendBirthdayNotifications() {
    if (!confirm('This will send a push notification to all subscribed batch members about today\'s birthdays. Continue?')) return;
    setNotifyState({ loading: true, message: '', error: '' });
    try {
      const response = await fetch('/api/notifications/send', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotifyState({ loading: false, message: '', error: getMessage(payload.error) || 'Failed to send notifications' });
        return;
      }
      setNotifyState({ loading: false, message: payload.message || 'Notifications sent!', error: '' });
    } catch (error) {
      setNotifyState({ loading: false, message: '', error: getMessage(error) || 'Failed to send notifications' });
    }
  }

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
        <div className="flex items-center justify-center py-20">
          <p className="text-zinc-500">Loading admin console...</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-10"
        >
          {/* Header Panel */}
          <div className="panel p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Admin Dashboard v2.2</p>
                <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Memorable Control</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
                  Manage your yearbook profiles, gallery memories, and wall notes. 
                  Now with social links, birthdays, and background music support.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (browserSupabase) await browserSupabase.auth.signOut();
                    router.push('/admin/login');
                  }}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-100 transition hover:bg-white/[0.08]"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => void sendBirthdayNotifications()}
                  disabled={notifyState.loading}
                  className="rounded-full bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-400 border border-emerald-500/20 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {notifyState.loading ? 'Sending...' : 'Notify Batch 🎂'}
                </button>
                {notifyState.message && <p className="text-[10px] text-emerald-400 text-center">{notifyState.message}</p>}
                {notifyState.error && <p className="text-[10px] text-red-400 text-center">{notifyState.error}</p>}
              </div>
            </div>
            {loadError ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4 text-sm text-red-100">
                {loadError}
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              {/* Profile Form */}
              <form
                key={profileFormKey}
                className="panel space-y-4 p-6 sm:p-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitProfile(event.currentTarget);
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-2xl text-white">
                    {editingProfile ? `Edit ${editingProfile.full_name}` : 'Add New Profile'}
                  </h2>
                  {editingProfile && (
                    <button
                      type="button"
                      onClick={() => setEditingProfile(null)}
                      className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                
                <div className="space-y-4">
                  <input name="full_name" required defaultValue={editingProfile?.full_name ?? ''} placeholder="Full Name" className="admin-input" />
                  <input name="role" defaultValue={editingProfile?.role ?? ''} placeholder="Role (e.g. Creative Lead)" className="admin-input" />
                  <input name="batch" defaultValue={editingProfile?.batch ?? 'Batch of 2022-26'} placeholder="Batch" className="admin-input" />
                  <textarea name="quote" rows={2} defaultValue={editingProfile?.quote ?? ''} placeholder="Legacy Quote" className="admin-input" />
                  <textarea name="story" rows={3} defaultValue={editingProfile?.story ?? ''} placeholder="Short Story" className="admin-input" />
                  
                  {/* Social Media Links Section */}
                  <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Social Media & Personal</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input name="whatsapp_url" defaultValue={editingProfile?.whatsapp_url ?? ''} placeholder="WhatsApp Link" className="admin-input text-xs" />
                      <input name="instagram_url" defaultValue={editingProfile?.instagram_url ?? ''} placeholder="Instagram Link" className="admin-input text-xs" />
                      <input name="snapchat_url" defaultValue={editingProfile?.snapchat_url ?? ''} placeholder="Snapchat Link" className="admin-input text-xs" />
                      <input name="twitter_url" defaultValue={editingProfile?.twitter_url ?? ''} placeholder="Twitter/X Link" className="admin-input text-xs" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-600">Birthday</span>
                        <input name="birthday" type="date" defaultValue={editingProfile?.birthday ?? ''} className="admin-input text-xs" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] uppercase tracking-widest text-zinc-600">Main Photo Align</span>
                        <select name="photo_alignment" defaultValue={editingProfile?.photo_alignment ?? 'center'} className="admin-input text-xs">
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-widest text-zinc-500">Portrait Photo</span>
                    <input name="photo" type="file" accept="image/*" className="admin-file-input" />
                  </label>
                </div>

                <input type="hidden" name="current_photo_path" defaultValue={editingProfile?.photo_path ?? ''} />
                <button type="submit" disabled={profileState.loading} className="admin-button w-full">
                  {profileState.loading ? 'Saving...' : editingProfile ? 'Update Profile' : 'Save Profile'}
                </button>
                {profileState.message && <p className="text-sm text-emerald-400">{profileState.message}</p>}
                {profileState.error && <p className="text-sm text-red-400">{profileState.error}</p>}
              </form>

              {/* Scrolling Photos Form */}
              <div className="panel space-y-6 p-6 sm:p-8">
                <h2 className="font-display text-2xl text-white">Manage Scrolling Photos</h2>
                
                <div className="space-y-4">
                  <select
                    value={selectedPriorityProfileId}
                    onChange={(e) => setSelectedPriorityProfileId(e.target.value)}
                    className="admin-input"
                  >
                    <option value="">Select a profile to manage</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>

                  {selectedPriorityProfile && (
                    <div className="space-y-4">
                      {/* Current List with Reordering */}
                      <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Existing Photos (Reorder/Delete)</p>
                        {selectedPriorityProfile.priority_photo_details.length === 0 ? (
                          <p className="py-4 text-center text-xs text-zinc-600 italic">No scrolling photos yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedPriorityProfile.priority_photo_details.map((item, index) => (
                              <div key={item.path} className="flex items-center gap-3 rounded-xl bg-black/40 p-2">
                                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                                  <img src={selectedPriorityProfile.priorityPhotoUrls[index]} alt="" className="h-full w-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-white">{item.title || 'Untitled'}</p>
                                  <p className="truncate text-[10px] text-zinc-500">{item.description || 'No description'}</p>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      if (index === 0) return;
                                      const next = [...selectedPriorityProfile.priority_photo_details];
                                      [next[index], next[index - 1]] = [next[index - 1], next[index]];
                                      void updatePriorityPhotoOrder(selectedPriorityProfile.id, next);
                                    }}
                                    disabled={index === 0 || priorityPhotoState.loading}
                                    className="rounded-lg bg-white/5 p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (index === selectedPriorityProfile.priority_photo_details.length - 1) return;
                                      const next = [...selectedPriorityProfile.priority_photo_details];
                                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                      void updatePriorityPhotoOrder(selectedPriorityProfile.id, next);
                                    }}
                                    disabled={index === selectedPriorityProfile.priority_photo_details.length - 1 || priorityPhotoState.loading}
                                    className="rounded-lg bg-white/5 p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!confirm('Delete this photo?')) return;
                                      const next = selectedPriorityProfile.priority_photo_details.filter((_, i) => i !== index);
                                      void updatePriorityPhotoOrder(selectedPriorityProfile.id, next);
                                    }}
                                    disabled={priorityPhotoState.loading}
                                    className="rounded-lg bg-red-500/10 p-1.5 text-red-500/60 hover:text-red-400 disabled:opacity-30"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add New Section */}
                      <form
                        className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.04] p-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void submitPriorityPhotos(event.currentTarget);
                        }}
                      >
                        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 font-medium">Add New Scrolling Photo</p>
                        <input type="hidden" name="profile_id" value={selectedPriorityProfileId} />
                        <input name="title" required placeholder="Photo Title" className="admin-input" />
                        <textarea name="description" rows={2} placeholder="Description" className="admin-input" />
                        <input name="priority_photos" type="file" accept="image/*" required className="admin-file-input" />
                        <button type="submit" disabled={priorityPhotoState.loading} className="admin-button w-full bg-white text-zinc-950">
                          {priorityPhotoState.loading ? 'Uploading...' : 'Upload New Photo'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
                {priorityPhotoState.message && <p className="text-sm text-emerald-400">{priorityPhotoState.message}</p>}
                {priorityPhotoState.error && <p className="text-sm text-red-400">{priorityPhotoState.error}</p>}
              </div>
            </div>

            <div className="space-y-6">
              {/* Gallery Form */}
              <form
                key={galleryFormKey}
                className="panel space-y-4 p-6 sm:p-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitGallery(event.currentTarget);
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-2xl text-white">
                    {editingGallery ? `Edit ${editingGallery.title}` : 'Add New Memory'}
                  </h2>
                  {editingGallery && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGallery(null);
                        setSelectedTaggedProfileIds([]);
                      }}
                      className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <input name="title" required defaultValue={editingGallery?.title ?? ''} placeholder="Memory Title" className="admin-input" />
                  <input name="category" list="occasions" required defaultValue={editingGallery?.category ?? ''} placeholder="Category/Year" className="admin-input" />
                  <datalist id="occasions">
                    <option value="1st Year" /><option value="2nd Year" /><option value="3rd Year" /><option value="4th Year" />
                    <option value="Events" /><option value="Farewell" />
                  </datalist>

                  <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Tag People</p>
                    <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                      {profiles.map((p) => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/[0.03] p-2 transition hover:bg-white/[0.06]">
                          <input
                            type="checkbox"
                            checked={selectedTaggedProfileIds.includes(p.id)}
                            onChange={(e) => {
                              setSelectedTaggedProfileIds(prev => 
                                e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                              );
                            }}
                            className="h-4 w-4 rounded border-white/10 bg-black/40"
                          />
                          <span className="text-xs text-zinc-200">{p.full_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[10px] uppercase tracking-widest text-zinc-500">Photo/Video</span>
                      <input name="image" type="file" accept="image/*,video/*" className="admin-file-input" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] uppercase tracking-widest text-zinc-500">Background Music (Opt)</span>
                      <input name="audio" type="file" accept="audio/*" className="admin-file-input" />
                    </label>
                  </div>
                </div>

                <input type="hidden" name="current_storage_path" defaultValue={editingGallery?.storage_path ?? ''} />
                <input type="hidden" name="current_audio_path" defaultValue={editingGallery?.audio_path ?? ''} />
                <input type="hidden" name="tagged_profile_ids_json" value={JSON.stringify(selectedTaggedProfileIds)} />
                
                <button type="submit" disabled={galleryState.loading} className="admin-button w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                  {galleryState.loading ? 'Saving...' : editingGallery ? 'Update Memory' : 'Save Memory'}
                </button>
                {galleryState.message && <p className="text-sm text-emerald-400">{galleryState.message}</p>}
                {galleryState.error && <p className="text-sm text-red-400">{galleryState.error}</p>}
              </form>

              {/* Stats Panel */}
              <div className="panel grid grid-cols-2 gap-4 p-6 sm:p-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Total Profiles</p>
                  <p className="mt-2 font-display text-4xl text-white">{profiles.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Total Memories</p>
                  <p className="mt-2 font-display text-4xl text-white">{gallery.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Management Lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6 sm:p-8">
              <h3 className="font-display text-2xl text-white">Manage Profiles</h3>
              <div className="mt-6 space-y-3">
                {profiles.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white/[0.03] p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{p.full_name}</p>
                      <p className="text-xs text-zinc-500">{p.role || 'Batch Mate'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingProfile(p)} className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white">Edit</button>
                      <button onClick={() => void deleteProfile(p)} className="text-[10px] uppercase tracking-widest text-red-500/60 hover:text-red-400">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel p-6 sm:p-8">
              <h3 className="font-display text-2xl text-white">Manage Gallery</h3>
              <div className="mt-6 space-y-3">
                {gallery.map(g => (
                  <div key={g.id} className="flex items-center justify-between rounded-2xl bg-white/[0.03] p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{g.title}</p>
                      <p className="text-xs text-zinc-500">{g.category}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingGallery(g)} className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white">Edit</button>
                      <button onClick={() => void deleteGallery(g)} className="text-[10px] uppercase tracking-widest text-red-500/60 hover:text-red-400">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Wall Management */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6 sm:p-8">
              <h3 className="font-display text-2xl text-white">Manage Wall Notes ({messages.length})</h3>
              <div className="mt-6 grid gap-4">
                {messages.map(m => (
                  <div key={m.id} className="relative rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">{m.author_name}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-zinc-300">{m.content}</p>
                    <button onClick={() => void deleteMessage(m)} className="mt-3 text-[10px] uppercase tracking-widest text-red-500/60 hover:text-red-400">Delete Note</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel p-6 sm:p-8">
              <h3 className="font-display text-2xl text-white">Alert Squad ({subscriptions.length})</h3>
              <p className="mt-2 text-xs text-zinc-500 italic">People who have enabled birthday notifications.</p>
              <div className="mt-6 max-h-[400px] overflow-y-auto space-y-3 pr-2">
                {subscriptions.length === 0 ? (
                  <p className="text-sm text-zinc-600 italic">No one has joined the squad yet.</p>
                ) : (
                  subscriptions.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl bg-white/[0.03] p-4">
                      <div>
                        <p className="font-medium text-white">{s.profile_name || 'Anonymous'}</p>
                        <p className="text-[10px] text-zinc-500">{new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                        </svg>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <style jsx global>{`
        .admin-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.2);
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
          transition: all 0.2s;
        }
        .admin-input:focus {
          border-color: rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.3);
        }
        .admin-file-input {
          display: block;
          width: 100%;
          font-size: 0.875rem;
          color: #a1a1aa;
        }
        .admin-file-input::-webkit-file-upload-button {
          margin-right: 1rem;
          border-radius: 9999px;
          border: 0;
          background: white;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #09090b;
          cursor: pointer;
        }
        .admin-button {
          border-radius: 9999px;
          background: white;
          padding: 0.75rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #09090b;
          transition: all 0.2s;
        }
        .admin-button:hover:not(:disabled) {
          background: #f4f4f5;
          transform: translateY(-1px);
        }
      `}</style>
    </section>
  );
}
