import { NextResponse } from 'next/server';
import { ensureAdminClient } from '@/lib/supabaseAdmin';

export async function DELETE(request: Request) {
  try {
    const admin = ensureAdminClient();
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 });
    }

    const { error } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
