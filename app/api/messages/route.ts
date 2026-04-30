import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { ensureAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function isMissingTableMessage(message: string) {
  return /schema cache|could not find the table/i.test(message);
}

export async function GET() {
  try {
    const admin = ensureAdminClient();
    const { data, error } = await admin
      .from('messages')
      .select('id, author_name, content, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableMessage(error.message)) {
        return NextResponse.json(
          { error: 'The public.messages table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = ensureAdminClient();
    const body = (await request.json().catch(() => ({}))) as {
      author_name?: string;
      content?: string;
    };

    const author_name = String(body.author_name ?? '').trim();
    const content = String(body.content ?? '').trim();

    if (!author_name || !content) {
      return NextResponse.json({ error: 'author_name and content are required' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('messages')
      .insert({ author_name, content })
      .select('id, author_name, content, created_at')
      .single();

    if (error) {
      if (isMissingTableMessage(error.message)) {
        return NextResponse.json(
          { error: 'The public.messages table is missing. Run supabase/seed.sql in Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateTag('messages');
    revalidateTag('home-counts');

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
