import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { recordFollowUpResult } from '@/modules/follow-ups/service';
import { correctResult } from '@/modules/workflow/service';
import { apiErrorResponse } from '@/lib/http/api-error';

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    return NextResponse.json(await recordFollowUpResult(client, context, await request.json()), { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'Unable to record result'); }
}

export async function PATCH(request: Request) {
  try {
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    const input = await request.json() as { resultId?: string };
    if (!input.resultId) throw new Error('RESULT_ID_REQUIRED');
    return NextResponse.json(await correctResult(client, context, input.resultId, input), { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'Unable to correct follow-up result'); }
}
