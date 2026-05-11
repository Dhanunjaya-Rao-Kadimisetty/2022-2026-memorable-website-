'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProfiles, type YearbookProfile } from '@/lib/supabaseClient';

export default function NotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [step, setStep] = useState<'prompt' | 'naming'>('prompt');
  const [profiles, setProfiles] = useState<YearbookProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
      setPermission(Notification.permission);
      
      const namePicked = localStorage.getItem('push_name_picked');
      const dismissed = localStorage.getItem('push_prompt_dismissed');

      // Show immediately if naming is needed or if they haven't decided yet
      if (Notification.permission === 'granted' && !namePicked) {
        setStep('naming');
        setShowPrompt(true);
      } else if (Notification.permission === 'default' && !dismissed) {
        setShowPrompt(true);
      }
    } else {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (step === 'naming') {
      fetchProfiles().then(setProfiles).catch(console.error);
    }
  }, [step]);

  const handleSubscribe = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
        });
        setStep('naming');
      } else {
        setShowPrompt(false);
      }
    } catch (err) {
      setShowPrompt(false);
    }
  };

  const handleSaveName = async () => {
    setIsSubmitting(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const profile = profiles.find(p => p.id === selectedProfileId);
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            subscription,
            profile_id: selectedProfileId,
            profile_name: profile?.full_name || 'Anonymous'
          }),
        });
        localStorage.setItem('push_name_picked', 'true');
      }
    } finally {
      setIsSubmitting(false);
      setShowPrompt(false);
    }
  };

  if (!isSupported || permission === 'denied') return null;
  const isAlreadySubscribed = permission === 'granted' && localStorage.getItem('push_name_picked') === 'true';

  return (
    <>
      <AnimatePresence>
        {!isAlreadySubscribed && !showPrompt && (
          <button
            onClick={() => setShowPrompt(true)}
            className="fixed bottom-6 right-6 z-[90] h-12 w-12 rounded-full bg-emerald-500 text-white shadow-lg flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          </button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrompt && (
          <>
            <div className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm" onClick={() => setShowPrompt(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed left-1/2 top-1/2 z-[100] w-[90%] max-w-[380px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-8 shadow-2xl"
            >
              {step === 'prompt' ? (
                <div className="space-y-6 text-center">
                  <h3 className="text-xl font-bold text-white">Birthday Alerts 🎂</h3>
                  <p className="text-sm text-zinc-400">Get a notification when someone in the batch has a birthday!</p>
                  <div className="flex flex-col gap-3">
                    <button onClick={handleSubscribe} className="w-full rounded-xl bg-white py-4 text-xs font-bold uppercase text-zinc-950">Notify Me</button>
                    <button onClick={() => { setShowPrompt(false); localStorage.setItem('push_prompt_dismissed', 'true'); }} className="text-[10px] font-bold text-zinc-500">Not now</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-center">
                  <h3 className="text-xl font-bold text-white">Who are you? Person</h3>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white focus:outline-none"
                  >
                    <option value="" disabled className="bg-zinc-900">Select your name...</option>
                    {profiles.map(p => <option key={p.id} value={p.id} className="bg-zinc-900">{p.full_name}</option>)}
                  </select>
                  <button onClick={handleSaveName} disabled={!selectedProfileId || isSubmitting} className="w-full rounded-xl bg-emerald-500 py-4 text-xs font-bold uppercase text-white disabled:opacity-50">
                    {isSubmitting ? 'Joining...' : 'Join Squad'}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
