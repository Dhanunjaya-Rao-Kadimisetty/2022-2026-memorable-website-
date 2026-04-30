import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { ensureAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const admin = ensureAdminClient();

    const { error } = await admin.from('messages').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateTag('messages');
    revalidateTag('home-counts');

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
