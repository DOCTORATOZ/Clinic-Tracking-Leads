import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { recordFollowUpResult } from '@/modules/follow-ups/service';
import { apiErrorResponse } from '@/lib/http/api-error';

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    return NextResponse.json(await recordFollowUpResult(client, context, await request.json()), { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'Unable to record result'); }
}
