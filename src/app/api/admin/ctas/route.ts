import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('ctas')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('priority_weight', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ctas: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const supabase = createServerClient();
  const { error } = await supabase
    .from('ctas')
    .update({ is_active: body.is_active })
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
