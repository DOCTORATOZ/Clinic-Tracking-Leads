import { NextResponse } from 'next/server';
import { requireClinicContext } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listNotifications } from '@/modules/operations/read-service';

export async function GET() {
  try { const client = await createSupabaseServerClient(); return NextResponse.json(await listNotifications(client, await requireClinicContext(client))); }
  catch (error) { return apiErrorResponse(error, 'Unable to load notifications'); }
}
