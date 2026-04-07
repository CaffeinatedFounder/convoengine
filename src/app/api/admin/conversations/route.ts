import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');

  // If conversation ID provided, return its messages
  if (id) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data });
  }

  // Otherwise, list recent conversations
  const { data, error } = await supabase
    .from('conversations')
    .select('id, channel, audience_type, status, current_agent_mode, started_at')
    .eq('tenant_id', TENANT_ID)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get message counts
  const conversationsWithCounts = await Promise.all(
    (data || []).map(async (conv) => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id);
      return { ...conv, message_count: count || 0 };
    })
  );

  return NextResponse.json({ conversations: conversationsWithCounts });
}
