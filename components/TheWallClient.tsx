'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, type FormEvent } from 'react';
import { postMessage, subscribeToMessages, supabase, type MessageNote } from '@/lib/supabaseClient';

type Props = {
  initialMessages: MessageNote[];
};

const rotations = [-4, 2, -1, 3, -3, 1];
const noteTones = ['bg-[#f5e1a4]', 'bg-[#efe2c6]', 'bg-[#f2d4d0]', 'bg-[#e4ebf4]'];

function getErrorMessage(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Could not post note.';
}

export default function TheWallClient({ initialMessages }: Props) {
  const [messages, setMessages] = useState<MessageNote[]>(initialMessages);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const supabaseReady = Boolean(supabase);

  useEffect(() => {
    if (!supabaseReady) return () => undefined;

    const unsubscribe = subscribeToMessages((message) => {
      setMessages((current) => [message, ...current.filter((item) => item.id !== message.id)]);
    });

    return () => {
      unsubscribe();
    };
  }, [supabaseReady]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorName.trim() || !content.trim()) return;
    setSubmitError('');

    if (!supabaseReady) {
      setSubmitError('Supabase is not configured. Add the required environment variables to post notes.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await postMessage({
        author_name: authorName,
        content,
      });

      if (error) {
        setSubmitError(getErrorMessage(error));
        return;
      }

      if (data) {
        setMessages((current) => [data, ...current]);
      }

      setAuthorName('');
      setContent('');
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      console.error(caughtError);
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const visibleMessages = messages;

  return (
    <section className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="panel p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">The Wall</p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Messages, pinned in time</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
            Drop a note, sign your name, and let the batch keep a living record of appreciation,
            gratitude, and all the little things that mattered.
          </p>

          {!supabaseReady ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Supabase is not connected yet. Add the environment variables to post notes to the live
              wall.
            </div>
          ) : null}
          {submitError ? (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {submitError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write a memory, thank you note, or parting line..."
              rows={5}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/20"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Posting...' : 'Pin Note'}
            </button>
          </form>
        </div>

        <div className="panel p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">Live board</p>
              <p className="mt-2 font-display text-2xl text-white">{visibleMessages.length} notes</p>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-zinc-400">
              Real-time
            </div>
          </div>

          {visibleMessages.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {visibleMessages.map((message, index) => {
                const rotation = rotations[index % rotations.length];
                const tone = noteTones[index % noteTones.length];
                return (
                  <motion.article
                    key={message.id}
                    initial={{ opacity: 0, scale: 0.92, rotate: rotation - 2 }}
                    animate={{ opacity: 1, scale: 1, rotate: rotation }}
                    transition={{ duration: 0.45, delay: index * 0.03 }}
                    className={`${tone} min-h-44 rounded-[28px] p-5 text-zinc-950 shadow-[0_20px_40px_rgba(0,0,0,0.22)]`}
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-700">
                      {message.author_name}
                    </p>
                    <p className="mt-4 text-sm leading-7">{message.content}</p>
                    <p className="mt-6 text-[11px] uppercase tracking-[0.25em] text-zinc-700">
                      {new Date(message.created_at).toLocaleDateString()}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-300">
              No messages yet. Once the <code className="rounded bg-white/10 px-1.5 py-0.5">messages</code>{' '}
              table is empty, the wall will stay blank until someone posts a new note.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
