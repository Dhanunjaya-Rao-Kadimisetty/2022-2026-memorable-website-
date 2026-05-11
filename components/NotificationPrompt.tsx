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

  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      // Register service worker
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service worker registration failed:', err);
      });

      setPermission(Notification.permission);
      
      const namePicked = localStorage.getItem('push_name_picked');
      
      // If they already granted permission but haven't picked a name, show naming modal
      if (Notification.permission === 'granted' && !namePicked) {
        setStep('naming');
        const timer = setTimeout(() => setShowPrompt(true), 1000);
        return () => clearTimeout(timer);
      }

      // Show initial prompt if they haven't decided yet
      const dismissed = localStorage.getItem('push_prompt_dismissed');
      if (Notification.permission === 'default' && !dismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 1500); // Show after 1.5s
        return () => clearTimeout(timer);
      }
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

        // Move to naming step
        setStep('naming');
      } else {
        setShowPrompt(false);
      }
    } catch (err) {
      console.error('Failed to subscribe:', err);
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
    } catch (error) {
      console.error('Error saving name:', error);
    } finally {
      setIsSubmitting(false);
      setShowPrompt(false);
    }
  };

  if (permission === 'granted' && step === 'prompt') return null;
  if (permission === 'denied') return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          {/* Backdrop for all centered prompts */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99] bg-black/70 backdrop-blur-md"
            onClick={() => setShowPrompt(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.9, x: '-50%' }}
            style={{ left: '50%', top: '50%', position: 'fixed', transform: 'translate(-50%, -50%)' }}
            className="z-[100] w-[90%] max-w-[420px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-2xl"
          >
            {step === 'prompt' ? (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500/20 text-emerald-400">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-display text-white">Never Miss a Birthday</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Get real-time alerts for every birthday in the batch. Join the celebration!
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={handleSubscribe}
                    className="w-full rounded-2xl bg-white py-4 text-xs font-bold uppercase tracking-widest text-zinc-950 transition hover:bg-zinc-200 shadow-xl shadow-white/5"
                  >
                    Notify Me 🎂
                  </button>
                  <button
                    onClick={() => {
                      setShowPrompt(false);
                      localStorage.setItem('push_prompt_dismissed', 'true');
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white"
                  >
                    Not now, maybe later
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500/20 text-emerald-400">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-display text-white">One Final Step</h3>
                  <p className="text-sm text-zinc-400">Select your profile so the Admin knows who you are!</p>
                </div>
                
                <div className="relative group">
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none text-center"
                  >
                    <option value="" disabled className="bg-zinc-900">Which profile is yours?</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">{p.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={handleSaveName}
                    disabled={!selectedProfileId || isSubmitting}
                    className="w-full rounded-2xl bg-emerald-500 py-4 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-emerald-400 disabled:opacity-50 shadow-xl shadow-emerald-500/20"
                  >
                    {isSubmitting ? 'Joining...' : 'I am in the Squad! 🎂'}
                  </button>
                  <button
                    onClick={() => setShowPrompt(false)}
                    className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white"
                  >
                    I&apos;ll do this later
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
