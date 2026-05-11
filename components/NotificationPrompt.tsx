'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      // Register service worker
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service worker registration failed:', err);
      });

      setPermission(Notification.permission);
      
      // Show prompt if they haven't decided yet
      const dismissed = localStorage.getItem('push_prompt_dismissed');
      if (Notification.permission === 'default' && !dismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 5000); // Show after 5s
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const subscribe = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });

        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });

        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    }
  };

  if (permission === 'denied' || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-6 left-6 z-[100] max-w-sm rounded-2xl border border-white/10 bg-cinematic-900/90 p-5 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">Birthday Alerts</h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Get notified when someone in the batch has a birthday so you don't miss out!
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={subscribe}
                className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-400"
              >
                Notify Me
              </button>
              <button
                onClick={() => {
                  setShowPrompt(false);
                  localStorage.setItem('push_prompt_dismissed', 'true');
                }}
                className="text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                Not Now
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowPrompt(false)}
            className="text-zinc-500 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
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
