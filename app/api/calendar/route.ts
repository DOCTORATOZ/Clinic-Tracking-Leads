import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { listCalendarItems } from '@/modules/calendar/service';

export async function GET(request: Request) {
  try {
    const from = new URL(request.url).searchParams.get('from'); const to = new URL(request.url).searchParams.get('to');
    if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    return NextResponse.json(await listCalendarItems(client, context, from, to));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load calendar' }, { status: 400 }); }
}
