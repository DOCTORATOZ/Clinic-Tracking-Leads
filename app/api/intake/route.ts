import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';
import { saveIntake } from '@/modules/patients/intake-service';

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient();
    const context = await requireClinicContext(client);
    return NextResponse.json(await saveIntake(client, context, await request.json()), { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'ไม่สามารถบันทึกลีดได้ กรุณาลองใหม่'); }
}
