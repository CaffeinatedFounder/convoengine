import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('handoff_requests')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handoffs: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const supabase = createServerClient();
  await supabase
    .from('handoff_requests')
    .update({ status: body.status, admin_notes: body.admin_notes })
    .eq('id', body.id);

  return NextResponse.json({ success: true });
}
