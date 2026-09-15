import { NextResponse } from 'next/server';
import { requireClinicContext } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listFollowUpTasks } from '@/modules/operations/read-service';

export async function GET() {
  try { const client = await createSupabaseServerClient(); return NextResponse.json(await listFollowUpTasks(client, await requireClinicContext(client))); }
  catch (error) { return apiErrorResponse(error, 'Unable to load follow-up tasks'); }
}
