import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { getCalendarConnection, listCalendarItems } from '@/modules/calendar/service';
import { apiErrorResponse } from '@/lib/http/api-error';

export async function GET(request: Request) {
  try {
    const from = new URL(request.url).searchParams.get('from'); const to = new URL(request.url).searchParams.get('to');
    if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    const [items, connection] = await Promise.all([
      listCalendarItems(client, context, from, to),
      getCalendarConnection(client, context),
    ]);
    return NextResponse.json({ items, connection });
  } catch (error) { return apiErrorResponse(error, 'Unable to load calendar'); }
}
