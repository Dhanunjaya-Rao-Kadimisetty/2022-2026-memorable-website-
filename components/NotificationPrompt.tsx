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
      
      // If they already granted permission but haven't picked a name, show the naming step in center
      if (Notification.permission === 'granted' && !namePicked) {
        setStep('naming');
        // Small delay for better UX
        const timer = setTimeout(() => setShowPrompt(true), 2000);
        return () => clearTimeout(timer);
      }

      // Show initial prompt if they haven't decided yet
      const dismissed = localStorage.getItem('push_prompt_dismissed');
      if (Notification.permission === 'default' && !dismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 5000); // Show after 5s
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
          {/* Backdrop for naming step to make it feel like a real modal */}
          {step === 'naming' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowPrompt(false)}
            />
          )}

          <motion.div
            initial={step === 'prompt' ? { y: 100, opacity: 0, scale: 0.9 } : { opacity: 0, scale: 0.9, y: 20 }}
            animate={step === 'prompt' ? { y: 0, opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: 0, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={step === 'naming' ? { left: '50%', top: '50%', position: 'fixed' } : {}}
            className={`z-[100] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl ${
              step === 'prompt' ? 'fixed bottom-6 left-6 w-[320px]' : 'w-[90%] max-w-[400px]'
            }`}
          >
            {step === 'prompt' ? (
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white">Birthday Alerts</h3>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Get notified when someone in the batch has a birthday so you don&apos;t miss out!
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={handleSubscribe}
                      className="rounded-full bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-950 transition hover:bg-zinc-200"
                    >
                      Notify Me
                    </button>
                    <button
                      onClick={() => {
                        setShowPrompt(false);
                        localStorage.setItem('push_prompt_dismissed', 'true');
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white"
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-display text-white">Join the Alert Squad</h3>
                  <p className="text-sm text-zinc-400">Select your profile so the Admin knows who you are!</p>
                </div>
                
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
                >
                  <option value="" disabled className="bg-zinc-900">Which profile is yours?</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">{p.full_name}</option>
                  ))}
                </select>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleSaveName}
                    disabled={!selectedProfileId || isSubmitting}
                    className="w-full rounded-2xl bg-emerald-500 py-4 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-emerald-400 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
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
