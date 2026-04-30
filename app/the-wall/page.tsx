import TheWallClient from '@/components/TheWallClient';
import { ensureAdminClient } from '@/lib/supabaseAdmin';
import type { MessageNote } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function TheWallPage() {
  let messages: MessageNote[] = [];

  try {
    const admin = ensureAdminClient();
    const { data } = await admin
      .from('messages')
      .select('id, author_name, content, created_at')
      .order('created_at', { ascending: false });

    messages = (data ?? []) as MessageNote[];
  } catch {
    messages = [];
  }

  return <TheWallClient initialMessages={messages} />;
}
