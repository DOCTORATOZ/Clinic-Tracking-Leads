import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/http/api-error';

export async function POST(request: Request) {
  try {
    const { clinicId } = await request.json() as { clinicId?: string };
    if (!clinicId) throw new Error('CLINIC_ID_REQUIRED');
    const client = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error('UNAUTHENTICATED');
    const { data, error } = await client.rpc('set_active_clinic', { target_clinic: clinicId });
    if (error || !data) throw new Error(error?.message ?? 'FORBIDDEN');
    return NextResponse.json({ clinicId: data });
  } catch (error) { return apiErrorResponse(error, 'Unable to switch clinic'); }
}
