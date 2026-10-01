import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { getCalendarConnection, listCalendarItems } from '@/modules/calendar/service';
import { apiErrorResponse } from '@/lib/http/api-error';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const params=new URL(request.url).searchParams;
    const {from,to}=z.object({from:z.iso.datetime({offset:true}),to:z.iso.datetime({offset:true})}).refine(v=>Date.parse(v.to)>Date.parse(v.from)&&Date.parse(v.to)-Date.parse(v.from)<=93*86400000,'ช่วงวันที่ต้องไม่เกิน 93 วัน').parse({from:params.get('from'),to:params.get('to')});
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    const [items, connection] = await Promise.all([
      listCalendarItems(client, context, from, to),
      getCalendarConnection(client, context),
    ]);
    return NextResponse.json({ items, connection });
  } catch (error) { return apiErrorResponse(error, 'Unable to load calendar'); }
}
