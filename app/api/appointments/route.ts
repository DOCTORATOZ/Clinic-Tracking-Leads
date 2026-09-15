import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { createAppointment } from '@/modules/appointments/service';
import { apiErrorResponse } from '@/lib/http/api-error';
import { listAppointments } from '@/modules/operations/read-service';

export async function GET() {
  try {
    const client = await createSupabaseServerClient();
    return NextResponse.json(await listAppointments(client, await requireClinicContext(client)));
  } catch (error) { return apiErrorResponse(error, 'Unable to load appointments'); }
}

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    return NextResponse.json(await createAppointment(client, context, await request.json()), { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'Unable to create appointment'); }
}
