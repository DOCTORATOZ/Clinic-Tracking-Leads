import { NextResponse } from 'next/server';
import { requireClinicContext } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { findPatientDuplicates } from '@/modules/patients/service';

export async function GET(request: Request) {
  try {
    const client = await createSupabaseServerClient();
    const context = await requireClinicContext(client);
    const url = new URL(request.url);
    return NextResponse.json(await findPatientDuplicates(client, context, { hn: url.searchParams.get('hn') ?? undefined, phone: url.searchParams.get('phone') ?? undefined }));
  } catch (error) { return apiErrorResponse(error, 'Unable to search patients'); }
}
